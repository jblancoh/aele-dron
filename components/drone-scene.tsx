/* oxlint-disable react-compiler, next/no-img-element -- Three.js requires imperative scene mutations and the static fallback is a local precompressed asset. */
'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { Object3D } from 'three';
import { useMotion } from './motion-context';

const MODEL_URL = '/media/drone/aele-white-drone.glb';
const ROTOR_NAMES = ['Rotor_FL', 'Rotor_FR', 'Rotor_RL', 'Rotor_RR'];

/**
 * React Three Fiber aims the default camera at the origin (it calls `camera.lookAt(0, 0, 0)`
 * unless a rotation is supplied), so the centre of the screen is world zero. Lifting the camera
 * without accounting for that tilt shifts every pose upward by the camera's height.
 */
export const CAMERA_Y = 0;
/**
 * Effective on-screen width of the model at scale 1, in world units. Measured by projecting the
 * GLB's vertices through this camera, so it accounts for perspective and the body rotation, not
 * just the raw bounding box. Re-measure it if the model is swapped.
 */
const DRONE_WIDTH_WORLD = 4;

/**
 * A pose in viewport space rather than world space: `x`/`y` are fractions of the viewport and
 * `width` is roughly how much of the viewport width the drone should cover. Expressing stops
 * this way keeps the choreography identical on every aspect ratio — world coordinates do not,
 * because the visible world extent depends on the canvas shape.
 */
export type DronePose = {
  x: number;
  y: number;
  width: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
};

/** A pose anchored to a real element, so the flight follows the layout instead of guessed scroll fractions. */
export type FlightStop = {
  selector: string | null;
  pose: DronePose;
  /**
   * Selector, inside the anchor element, whose bottom edge the parked drone must sit below.
   * Measured live, so the drone follows the copy if it is ever rewritten.
   */
  clearBelow?: string;
  /**
   * Where the element's top should sit, as a fraction of the viewport height, when the drone
   * reaches this stop. Omit it to reach the stop with the element centred — which is far too
   * late for a tall section near the end of the page, because "centred" only happens once the
   * section is already scrolling away.
   */
  align?: number;
};

/** Parked beside the contact form: low on the left, small, turned to watch the panel. */
export const LANDING_POSE: DronePose = {
  x: 0.26,
  y: 0.76,
  width: 0.34,
  rotationX: 0.06,
  rotationY: 0.42,
  rotationZ: 0.02,
};

/**
 * Every section leaves the drone a different gap, so each one gets its own pose. Negative
 * `rotationY` turns the drone's camera toward screen-left, positive toward screen-right.
 */
export const FLIGHT_STOPS: FlightStop[] = [
  // The hero copy is centred and runs from the eyebrow at ~33vh to the actions near the bottom,
  // so the drone holds the band between the header rule and the eyebrow instead of crossing it.
  { selector: null, pose: { x: 0.5, y: 0.28, width: 0.32, rotationX: 0.05, rotationY: -0.1, rotationZ: 0 } },
  // Every film stays pinned left, so the drone holds the right lane and watches across, and the
  // three stops share a height to read as one steady pass rather than three separate hops.
  { selector: '.film-0', pose: { x: 0.78, y: 0.5, width: 0.3, rotationX: 0.06, rotationY: -0.52, rotationZ: -0.07 } },
  { selector: '.film-1', pose: { x: 0.78, y: 0.5, width: 0.3, rotationX: 0.04, rotationY: -0.46, rotationZ: 0.05 } },
  { selector: '.film-2', pose: { x: 0.78, y: 0.5, width: 0.3, rotationX: 0.06, rotationY: -0.52, rotationZ: -0.07 } },
  // The story footage is full-bleed, so there is no gap to sit in — the drone pulls back instead.
  { selector: '.scroll-story', pose: { x: 0.84, y: 0.24, width: 0.18, rotationX: 0.06, rotationY: -0.44, rotationZ: -0.05 } },
  // Services keeps its copy top-left and its list on the right; the drone drops under the copy.
  { selector: '#nosotros', pose: { x: 0.24, y: 0.74, width: 0.34, rotationX: 0.04, rotationY: 0.26, rotationZ: 0.03 } },
  // One stop on the contact section, so the whole tail of the flight is a single unbroken
  // descent. An extra approach stop between the two sections looks tempting, but the drone is
  // already low under the services copy and the contact section is a screen further down: any
  // stop in between has to lift it back up before it can drop again, and that reversal is the
  // jolt readers see as section three hands over to section four.
  { selector: '#contacto', align: 0.28, clearBelow: '.contact-intro p:last-of-type', pose: LANDING_POSE },
];

/** Gimbal aim held once parked, on top of the body rotation, so the camera stays on the form. */
export const GIMBAL_LANDING_YAW = 0.28;
export const GIMBAL_LANDING_PITCH = 0.05;

const CRUISE_SPEED = 28;
/** Fraction of the page over which the rotors wind up from rest, so the flight has a start. */
const TAKEOFF_SPAN = 0.05;
/** Breathing room between the copy the drone parks under and the drone itself, in pixels. */
const PARK_GAP = 40;
const ROTOR_SPIN_UP = 3.6;
const ROTOR_SPIN_DOWN = 1.6;
const ROTOR_STOP_EPSILON = 0.03;

export type ResolvedStop = { at: number; pose: DronePose };
type Measured = { top: number; height: number } | null;

/**
 * Turn each anchored stop into the scroll progress at which its element sits centred in the
 * viewport. Stops whose element is missing are dropped, so removing a section degrades to a
 * shorter flight rather than a broken one.
 */
export function resolveStopOffsets(
  stops: FlightStop[],
  measure: (selector: string) => Measured,
  viewportHeight: number,
  maxScroll: number,
): ResolvedStop[] {
  const span = Math.max(1, maxScroll);
  const resolved: ResolvedStop[] = [];
  for (const stop of stops) {
    if (stop.selector === null) {
      resolved.push({ at: 0, pose: stop.pose });
      continue;
    }
    const rect = measure(stop.selector);
    if (!rect) continue;
    const scrollAt =
      stop.align === undefined
        ? rect.top + rect.height / 2 - viewportHeight / 2
        : rect.top - stop.align * viewportHeight;
    resolved.push({ at: clamp(scrollAt / span), pose: stop.pose });
  }
  return resolved.sort((a, b) => a.at - b.at);
}

/**
 * Blend between the two stops surrounding the current scroll position. `landing` is the weight
 * of the final stop, which also drives the rotor wind-down and the gimbal lock.
 */
export function interpolatePose(stops: ResolvedStop[], progress: number) {
  const value = clamp(progress);
  if (stops.length === 0) return { pose: LANDING_POSE, landing: 0 };
  if (stops.length === 1) return { pose: stops[0].pose, landing: 0 };
  const nextIndex = stops.findIndex((stop) => stop.at >= value);
  // Past the final stop the drone stays parked; before the first one it holds the opening pose.
  if (nextIndex === -1) return { pose: stops[stops.length - 1].pose, landing: 1 };
  if (nextIndex === 0) return { pose: stops[0].pose, landing: 0 };
  const from = stops[nextIndex - 1];
  const to = stops[nextIndex];
  const span = Math.max(0.0001, to.at - from.at);
  const t = clamp((value - from.at) / span);
  const mix = (a: number, b: number) => a + (b - a) * t;
  return {
    pose: {
      x: mix(from.pose.x, to.pose.x),
      y: mix(from.pose.y, to.pose.y),
      width: mix(from.pose.width, to.pose.width),
      rotationX: mix(from.pose.rotationX, to.pose.rotationX),
      rotationY: mix(from.pose.rotationY, to.pose.rotationY),
      rotationZ: mix(from.pose.rotationZ, to.pose.rotationZ),
    },
    landing: nextIndex === stops.length - 1 ? t : 0,
  };
}

/**
 * Where the model's silhouette sits relative to its origin, as multiples of the pose width.
 * Measured by projecting the GLB through this camera.
 */
const DRONE_TOP_RATIO = 0.37;

/**
 * Resting place of the parked drone, as a viewport fraction. The section's copy is laid out in
 * pixels while poses are viewport fractions, so a fixed fraction cannot clear the same text on a
 * short laptop and a tall monitor. Anchoring to the section's own pixels does, and because the
 * spot is measured from the section's live top edge the drone also scrolls away with the page
 * instead of staying glued to the screen.
 */
export function parkedPoseY(
  anchorTop: number,
  clearBelow: number,
  width: number,
  viewportHeight: number,
) {
  if (viewportHeight <= 0) return 0.5;
  return (anchorTop + clearBelow) / viewportHeight + DRONE_TOP_RATIO * width;
}

/** Convert a viewport-space pose into the world transform the model needs. */
export function poseToWorld(pose: DronePose, worldWidth: number, worldHeight: number) {
  return {
    x: (pose.x - 0.5) * worldWidth,
    y: CAMERA_Y + (0.5 - pose.y) * worldHeight,
    scale: (pose.width * worldWidth) / DRONE_WIDTH_WORLD,
  };
}

/**
 * The pose for a scroll position, with the parked height already resolved.
 *
 * The last stop is a spot on the page rather than on the screen, so the final approach has to be
 * blended in document coordinates. Mixing a page-anchored target into a viewport-space pose with
 * a linear weight hits the same two ends but curves badly in between: the target climbs the
 * screen exactly as fast as the reader scrolls, so an early weight of it drags the drone into a
 * dive and a late one lets it float back up. That parabola is a visible dive-and-recover. Blended
 * in document space the descent runs at one steady speed from the previous stop to the spot.
 */
export function flightPose(
  stops: ResolvedStop[],
  scrolled: number,
  maxScroll: number,
  viewportHeight: number,
  parked: { docTop: number; clearBelow: number } | null,
) {
  const span = Math.max(1, maxScroll);
  const { pose, landing } = interpolatePose(stops, scrolled / span);
  const approach = stops[stops.length - 2];
  if (!parked || !approach || landing <= 0 || viewportHeight <= 0) return { pose, landing };
  const parkedFraction = parkedPoseY(
    parked.docTop - scrolled,
    parked.clearBelow,
    LANDING_POSE.width,
    viewportHeight,
  );
  const parkedDocY = scrolled + parkedFraction * viewportHeight;
  const startDocY = approach.at * span + approach.pose.y * viewportHeight;
  const docY = startDocY + (parkedDocY - startDocY) * landing;
  return { pose: { ...pose, y: (docY - scrolled) / viewportHeight }, landing };
}

export function rotorTargetSpeed(progress: number, landing: number) {
  const takeoff = clamp(clamp(progress) / TAKEOFF_SPAN);
  const flight = CRUISE_SPEED * (0.8 + clamp(progress) * 0.2);
  return flight * takeoff * (1 - clamp(landing));
}

/** Motors gain speed quickly under power and lose it slowly to inertia. */
export function stepRotorSpeed(current: number, target: number, delta: number) {
  const next = damp(current, target, target > current ? ROTOR_SPIN_UP : ROTOR_SPIN_DOWN, delta);
  const stopped = Math.abs(next) < ROTOR_STOP_EPSILON && Math.abs(target) < ROTOR_STOP_EPSILON;
  return stopped ? 0 : next;
}

export function pointerLook(pointer: { x: number; y: number }, landing: number) {
  const t = clamp(landing);
  const influence = 1 - t;
  return {
    yaw: pointer.x * 0.22 * influence + GIMBAL_LANDING_YAW * t,
    pitch: pointer.y * 0.14 * influence + GIMBAL_LANDING_PITCH * t,
  };
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function damp(current: number, target: number, speed: number, delta: number) {
  return current + (target - current) * (1 - Math.exp(-speed * delta));
}

/**
 * Damping is what gives the flight its weight, but it is exactly wrong for a parked drone: the
 * target moves with the page every frame, so any lag reads as the drone sliding about instead of
 * resting on the section. `exact` hands over from damped to rigid as the landing completes.
 */
export function follow(current: number, target: number, speed: number, delta: number, exact: number) {
  const smooth = damp(current, target, speed, delta);
  return smooth + (target - smooth) * clamp(exact);
}

function findNode(scene: Object3D, name: string) {
  return scene.getObjectByName(name) ?? undefined;
}

type PointerRef = { current: { x: number; y: number } };

function DroneModel({ pointer }: { pointer: PointerRef }) {
  const { scene } = useGLTF(MODEL_URL);
  const { viewport, size } = useThree();
  const maxScroll = useRef(1);
  const anchorDocTop = useRef(Number.POSITIVE_INFINITY);
  const stops = useRef<ResolvedStop[]>([]);
  const clearBelow = useRef(0);
  const rotorSpeed = useRef(0);
  const nodes = useMemo(() => {
    const droneRoot = findNode(scene, 'DroneRoot') ?? scene;
    return {
      root: droneRoot,
      yaw: findNode(scene, 'GimbalYaw'),
      pitch: findNode(scene, 'GimbalPitch'),
      rotors: ROTOR_NAMES.map((name) => findNode(scene, name)).filter(
        (node): node is Object3D => Boolean(node),
      ),
    };
  }, [scene]);

  useEffect(() => {
    if (typeof scene.traverse !== 'function') return;
    scene.traverse((node) => {
      if (/Obstacle sensor/i.test(node.name)) node.visible = false;
    });
  }, [scene]);

  useEffect(() => {
    const measure = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { top: rect.top + window.scrollY, height: rect.height };
    };
    const parked = FLIGHT_STOPS[FLIGHT_STOPS.length - 1];
    let measuredHeight = 0;
    const remeasure = () => {
      measuredHeight = document.documentElement.scrollHeight;
      maxScroll.current = Math.max(1, measuredHeight - window.innerHeight);
      stops.current = resolveStopOffsets(FLIGHT_STOPS, measure, window.innerHeight, maxScroll.current);
      const element = parked.selector ? document.querySelector(parked.selector) : null;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      anchorDocTop.current = rect.top + window.scrollY;
      const copy = parked.clearBelow ? element.querySelector(parked.clearBelow) : null;
      clearBelow.current = copy ? copy.getBoundingClientRect().bottom - rect.top + PARK_GAP : 0;
    };
    const onScroll = () => {
      // Lazy-loaded posters keep changing the page height as the reader travels down it, which
      // would leave every stop anchored to a document that no longer exists.
      if (document.documentElement.scrollHeight !== measuredHeight) remeasure();
    };
    remeasure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', remeasure, { passive: true });
    const observer = new ResizeObserver(remeasure);
    observer.observe(document.body);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', remeasure);
    };
  }, []);

  useFrame((_, delta) => {
    // Read the scroll here rather than in a listener: a parked drone that is one frame behind
    // the page is a drone that visibly slides.
    const scrolled = window.scrollY;
    const progress = clamp(scrolled / maxScroll.current);
    // The final destination is a spot on the page, so it is resolved from the live layout rather
    // than baked into the pose; LANDING_POSE.y only stands in until the section can be measured.
    const parked = Number.isFinite(anchorDocTop.current)
      ? { docTop: anchorDocTop.current, clearBelow: clearBelow.current }
      : null;
    const { pose, landing } = flightPose(stops.current, scrolled, maxScroll.current, size.height, parked);
    const target = poseToWorld(pose, viewport.width, viewport.height);
    const look = pointerLook(pointer.current, landing);
    const root = nodes.root;
    const yaw = nodes.yaw;
    const pitch = nodes.pitch;

    root.position.x = follow(root.position.x, target.x, 2.8, delta, landing);
    root.position.y = follow(root.position.y, target.y, 2.8, delta, landing);
    root.rotation.x = damp(root.rotation.x, pose.rotationX, 2.8, delta);
    root.rotation.y = damp(root.rotation.y, pose.rotationY, 2.8, delta);
    root.rotation.z = damp(root.rotation.z, pose.rotationZ, 2.8, delta);
    root.scale.setScalar(follow(root.scale.x, target.scale, 2.8, delta, landing));
    if (yaw) yaw.rotation.y = damp(yaw.rotation.y, look.yaw, 5, delta);
    if (pitch) pitch.rotation.x = damp(pitch.rotation.x, look.pitch, 5, delta);

    rotorSpeed.current = stepRotorSpeed(rotorSpeed.current, rotorTargetSpeed(progress, landing), delta);
    if (rotorSpeed.current !== 0) {
      for (const [index, rotor] of nodes.rotors.entries()) {
        rotor.rotation.y += delta * (index % 2 === 0 ? rotorSpeed.current : -rotorSpeed.current);
      }
    }
  });

  return <primitive object={scene} />;
}

function SceneCanvas({ active, pointer }: { active: boolean; pointer: PointerRef }) {
  return (
    <Canvas
      className="drone-canvas"
      aria-hidden="true"
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 1.25]}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 30, position: [0, CAMERA_Y, 6.2], near: 0.1, far: 100 }}
    >
      <ambientLight intensity={1.6} />
      <directionalLight position={[3, 4, 5]} intensity={2.2} />
      <directionalLight position={[-4, 1, -2]} intensity={0.8} color="#8aa3a8" />
      <Suspense fallback={null}>
        <DroneModel pointer={pointer} />
      </Suspense>
    </Canvas>
  );
}

export function DroneScene() {
  const { reduced, desktop, saveData } = useMotion();
  const eligible = desktop && !reduced && !saveData;
  const [visible, setVisible] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(true);
  const sceneRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const active = eligible && visible && documentVisible;

  useEffect(() => {
    const element = sceneRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? true),
      { threshold: 0, rootMargin: '120px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onVisibility = () => setDocumentVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!active) return;
    const onPointerMove = (event: PointerEvent) => {
      pointer.current.x = clamp((event.clientX / window.innerWidth) * 2 - 1, -1, 1);
      pointer.current.y = clamp((event.clientY / window.innerHeight) * 2 - 1, -1, 1);
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [active]);

  // No still stands in for the drone: on phones, reduced motion or save-data the page simply
  // renders without it rather than dropping a decorative photo over the copy.
  if (!eligible) return null;

  return (
    <div
      ref={sceneRef}
      className="drone-scene"
      data-active={active}
      aria-label="Dron 3D interactivo"
    >
      <SceneCanvas active={active} pointer={pointer} />
    </div>
  );
}
