/* oxlint-disable react-compiler, next/no-img-element -- Three.js requires imperative scene mutations and the static fallback is a local precompressed asset. */
'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { Object3D } from 'three';
import { useMotion } from './motion-context';

const MODEL_URL = '/media/drone/aele-graphite-drone.glb';
const ROTOR_NAMES = ['Rotor_FL', 'Rotor_FR', 'Rotor_RL', 'Rotor_RR'];

/** The camera sits slightly above the origin, so screen centre maps to this world height. */
export const CAMERA_Y = 0.75;
/** Effective on-screen width of the model at scale 1, in world units (measured from the GLB). */
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
export type FlightStop = { selector: string | null; pose: DronePose };

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
  { selector: null, pose: { x: 0.5, y: 0.5, width: 0.46, rotationX: 0.04, rotationY: -0.1, rotationZ: 0 } },
  // Every film stays pinned left, so the drone holds the right lane and watches across, and the
  // three stops share a height to read as one steady pass rather than three separate hops.
  { selector: '.film-0', pose: { x: 0.78, y: 0.5, width: 0.3, rotationX: 0.06, rotationY: -0.52, rotationZ: -0.07 } },
  { selector: '.film-1', pose: { x: 0.78, y: 0.5, width: 0.3, rotationX: 0.04, rotationY: -0.46, rotationZ: 0.05 } },
  { selector: '.film-2', pose: { x: 0.78, y: 0.5, width: 0.3, rotationX: 0.06, rotationY: -0.52, rotationZ: -0.07 } },
  // The story footage is full-bleed, so there is no gap to sit in — the drone pulls back instead.
  { selector: '.scroll-story', pose: { x: 0.84, y: 0.24, width: 0.18, rotationX: 0.06, rotationY: -0.44, rotationZ: -0.05 } },
  // Services keeps its copy top-left and its list on the right; the drone drops under the copy.
  { selector: '#nosotros', pose: { x: 0.24, y: 0.74, width: 0.34, rotationX: 0.04, rotationY: 0.26, rotationZ: 0.03 } },
  { selector: '#contacto', pose: LANDING_POSE },
];

/** Gimbal aim held once parked, on top of the body rotation, so the camera stays on the form. */
export const GIMBAL_LANDING_YAW = 0.28;
export const GIMBAL_LANDING_PITCH = 0.05;

const CRUISE_SPEED = 28;
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
    const centred = rect.top + rect.height / 2 - viewportHeight / 2;
    resolved.push({ at: clamp(centred / span), pose: stop.pose });
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

/** Convert a viewport-space pose into the world transform the model needs. */
export function poseToWorld(pose: DronePose, worldWidth: number, worldHeight: number) {
  return {
    x: (pose.x - 0.5) * worldWidth,
    y: CAMERA_Y + (0.5 - pose.y) * worldHeight,
    scale: (pose.width * worldWidth) / DRONE_WIDTH_WORLD,
  };
}

export function rotorTargetSpeed(progress: number, landing: number) {
  const flight = CRUISE_SPEED * (0.8 + clamp(progress) * 0.2);
  return flight * (1 - clamp(landing));
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

function findNode(scene: Object3D, name: string) {
  return scene.getObjectByName(name) ?? undefined;
}

type PointerRef = { current: { x: number; y: number } };

function DroneModel({ pointer }: { pointer: PointerRef }) {
  const { scene } = useGLTF(MODEL_URL);
  const { viewport } = useThree();
  const scrollProgress = useRef(0);
  const stops = useRef<ResolvedStop[]>([]);
  const rotorSpeed = useRef(rotorTargetSpeed(0, 0));
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
    const remeasure = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      scrollProgress.current = clamp(window.scrollY / maxScroll);
      stops.current = resolveStopOffsets(FLIGHT_STOPS, measure, window.innerHeight, maxScroll);
    };
    const onScroll = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      scrollProgress.current = clamp(window.scrollY / maxScroll);
    };
    remeasure();
    // The layout settles after fonts and posters load, so take a second reading.
    const settle = window.setTimeout(remeasure, 1200);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', remeasure, { passive: true });
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', remeasure);
    };
  }, []);

  useFrame((_, delta) => {
    const progress = scrollProgress.current;
    const { pose, landing } = interpolatePose(stops.current, progress);
    const target = poseToWorld(pose, viewport.width, viewport.height);
    const look = pointerLook(pointer.current, landing);
    const root = nodes.root;
    const yaw = nodes.yaw;
    const pitch = nodes.pitch;

    root.position.x = damp(root.position.x, target.x, 2.8, delta);
    root.position.y = damp(root.position.y, target.y, 2.8, delta);
    root.rotation.x = damp(root.rotation.x, pose.rotationX, 2.8, delta);
    root.rotation.y = damp(root.rotation.y, pose.rotationY, 2.8, delta);
    root.rotation.z = damp(root.rotation.z, pose.rotationZ, 2.8, delta);
    root.scale.setScalar(damp(root.scale.x, target.scale, 2.8, delta));
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
