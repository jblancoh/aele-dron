/* oxlint-disable react-compiler, next/no-img-element -- Three.js requires imperative scene mutations and the static fallback is a local precompressed asset. */
'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AdaptiveDpr, AdaptiveEvents, PerformanceMonitor, useGLTF } from '@react-three/drei';
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace, type Object3D } from 'three';
import { useMotion } from './motion-context';

const MODEL_URL = '/media/drone/aele-white-drone.glb';
const ROTOR_NAMES = ['Rotor_FL', 'Rotor_FR', 'Rotor_RL', 'Rotor_RR'];

/**
 * Measured, not predicted: `useDetectGPU` was rejected (see the plan) because it is a device
 * lookup table — it downloads a benchmark JSON at runtime and still misses new Android GPUs.
 * Instead, drei's `PerformanceMonitor` samples the running session's own frame times, and a lost
 * WebGL context is treated as the catastrophic version of the same signal (see `SceneCanvas`).
 * Both land on the same verdict, kept in a storage key separate from `aele:motion` (the visitor's
 * own preference in motion-context.tsx) because this one is capacity, not preference, and the
 * visitor never opted into it.
 */
const DRONE_TIER_STORAGE_KEY = 'aele:drone-tier';
/**
 * Bumped whenever the scene itself gets more expensive to render — new geometry, shadows, or
 * materials. A verdict measured against last month's cheaper scene should not silently suppress
 * the drone under a heavier one it never actually failed on (and vice versa).
 */
const DRONE_TIER_VERSION = 1;
const DRONE_TIER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * `PerformanceMonitor` measures `useFrame` timing, not raw device speed, so the GLB parse and
 * shader compile that happen in the first second after mount read as terrible frame times on
 * every device, fast or slow. Without a grace period `onFallback` would degrade all of them.
 */
const PERFORMANCE_WARM_UP_MS = 1400;

type DroneTierVerdict = { v: number; verdict: 'low'; at: number };

function readLowVerdict(): DroneTierVerdict | null {
  try {
    const raw = window.localStorage.getItem(DRONE_TIER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DroneTierVerdict>;
    if (parsed.v !== DRONE_TIER_VERSION || parsed.verdict !== 'low' || typeof parsed.at !== 'number') return null;
    if (Date.now() - parsed.at > DRONE_TIER_TTL_MS) return null;
    return parsed as DroneTierVerdict;
  } catch {
    // Safari private browsing (and similar) throws on read; treat it as "no verdict on file".
    return null;
  }
}

function persistLowVerdict() {
  try {
    const verdict: DroneTierVerdict = { v: DRONE_TIER_VERSION, verdict: 'low', at: Date.now() };
    window.localStorage.setItem(DRONE_TIER_STORAGE_KEY, JSON.stringify(verdict));
  } catch {
    // Write blocked (e.g. private browsing): the verdict just won't survive a reload.
  }
}

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

/**
 * Parked stop for the mobile flight (see `MOBILE_FLIGHT_STOPS`): tucked into the ~100px strip
 * between the end of `.contact-section` (`padding-bottom:80px`) and `.footer-top`
 * (`padding-top:20px`) — the mobile analogue of `LANDING_POSE`, sized down for a narrower
 * viewport. `y` here is only the pre-measurement fallback (see `flightPose`); the real vertical
 * position is resolved live from `.contact-form-panel`'s bottom edge via `clearBelow`, same as
 * desktop.
 */
export const MOBILE_LANDING_POSE: DronePose = {
  x: 0.14,
  y: 0.86,
  width: 0.18,
  rotationX: 0.06,
  rotationY: 0.32,
  rotationZ: 0.02,
};

/**
 * Mobile's own flight stops. The compacted mobile layout leaves almost no open ground: the
 * single-column catalogue and the stacked `#nosotros` have no gap beside their content at all, so
 * the drone crosses those pinned small against a margin instead of resting in a gap that does not
 * exist — see the per-stop comments below. Kept separate from `FLIGHT_STOPS` (desktop) because
 * every pose here is sized and placed for a ~390px-wide viewport; mixing the two sets would either
 * crush the desktop poses or blow the mobile ones off-screen.
 */
export const MOBILE_FLIGHT_STOPS: FlightStop[] = [
  // Reducing the mobile h1 to clamp(40px,9vw,60px) opened a real band under the hero copy. The
  // drone holds it left of centre so it never nears `.motion-control` (right:7%, bottom:82px —
  // i.e. x>0.8 and y>0.84 at once).
  { selector: null, pose: { x: 0.42, y: 0.72, width: 0.22, rotationX: 0.05, rotationY: -0.08, rotationZ: 0 } },
  // The single-column catalogue leaves no gap beside the posters, so the drone crosses pinned to
  // the right margin, small enough (width 0.14) to read as background depth instead of a cover.
  { selector: '.film-0', pose: { x: 0.9, y: 0.45, width: 0.14, rotationX: 0.05, rotationY: -0.5, rotationZ: -0.05 } },
  { selector: '.film-1', pose: { x: 0.9, y: 0.5, width: 0.14, rotationX: 0.04, rotationY: -0.46, rotationZ: 0.04 } },
  { selector: '.film-2', pose: { x: 0.9, y: 0.45, width: 0.14, rotationX: 0.05, rotationY: -0.5, rotationZ: -0.05 } },
  // The story is still full-bleed on mobile, but its own top band (above the centred copy) is
  // clear — and, unlike the margins the drone hugs elsewhere, there is real room here, so it grows
  // back out instead of staying pinned small.
  { selector: '.scroll-story', pose: { x: 0.62, y: 0.22, width: 0.22, rotationX: 0.05, rotationY: -0.3, rotationZ: -0.03 } },
  // `#nosotros` stacks its heading over its list with no side gap either, so the drone holds the
  // left margin — crossing right-to-left gives the pass its own direction instead of repeating the
  // catalogue's right-hand lane.
  { selector: '#nosotros', pose: { x: 0.1, y: 0.55, width: 0.14, rotationX: 0.04, rotationY: 0.3, rotationZ: 0.03 } },
  // Desktop clears `.contact-intro p:last-of-type`, but on the stacked mobile layout the form
  // panel sits below that paragraph, not open air — clearing the panel itself is what actually
  // lands the drone in the one open strip left in this section: between `.contact-form-panel` and
  // `.footer-top`.
  { selector: '#contacto', align: 0.3, clearBelow: '.contact-form-panel', pose: MOBILE_LANDING_POSE },
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

/**
 * `DroneModel` used to have two different ways to drive itself: scroll-linked flight (desktop) or
 * a stationary, wall-clock-driven hover bounded to the hero (mobile/lite). That hover mode is gone
 * — mobile now flies the scroll too, over `MOBILE_FLIGHT_STOPS` instead of `FLIGHT_STOPS`. The
 * only things this value still selects are which stop list to fly and the cheap-vs-full WebGL
 * quality profile in `SceneCanvas` (dpr ceiling, shadows, antialiasing, light count) — a render
 * profile, not a locomotion mode, hence the rename from `DroneMode` to `DroneProfile`. It mirrors
 * `capabilityTier`'s non-`'none'` states 1:1 (see `DroneScene`, which only ever computes this once
 * eligibility has already filtered `'none'` out) but is kept as its own type so `DroneModel` and
 * `SceneCanvas` never have to account for the `'none'` case at all.
 */
export type DroneProfile = 'full' | 'lite';

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

function DroneModel({ pointer, profile }: { pointer: PointerRef; profile: DroneProfile }) {
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
    // The lite canvas never enables shadows (see `SceneCanvas`), so flagging meshes as shadow
    // casters there would just be wasted per-mesh state with nothing to show for it.
    const castsShadows = profile === 'full';
    scene.traverse((node) => {
      if (/Obstacle sensor/i.test(node.name)) node.visible = false;
      const mesh = node as Object3D & { isMesh?: boolean; castShadow?: boolean; receiveShadow?: boolean };
      if (mesh.isMesh) {
        mesh.castShadow = castsShadows;
        // Casters must receive too. The drone floats alone — there is no floor plane for its
        // shadow to land on — so self-shadowing (arms and rotors onto the body) is the only thing
        // the shadow map can ever show. Leaving this `false` while `shadows` is on means the
        // renderer fills a shadow map every frame that no material ever samples.
        mesh.receiveShadow = castsShadows;
      }
    });
  }, [scene, profile]);

  useEffect(() => {
    // Both profiles fly the scroll now, just over different stop lists — see `MOBILE_FLIGHT_STOPS`
    // for why mobile needs its own set rather than reusing `FLIGHT_STOPS`.
    const activeStops = profile === 'lite' ? MOBILE_FLIGHT_STOPS : FLIGHT_STOPS;
    const measure = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { top: rect.top + window.scrollY, height: rect.height };
    };
    const parked = activeStops[activeStops.length - 1];
    let measuredHeight = 0;
    const remeasure = () => {
      measuredHeight = document.documentElement.scrollHeight;
      maxScroll.current = Math.max(1, measuredHeight - window.innerHeight);
      stops.current = resolveStopOffsets(activeStops, measure, window.innerHeight, maxScroll.current);
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
  }, [profile]);

  useFrame((_state, delta) => {
    const root = nodes.root;
    const yaw = nodes.yaw;
    const pitch = nodes.pitch;

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

function SceneCanvas({
  active,
  pointer,
  profile,
  onDegrade,
  onContextLost,
}: {
  active: boolean;
  pointer: PointerRef;
  profile: DroneProfile;
  onDegrade: () => void;
  onContextLost: () => void;
}) {
  // The lite canvas runs on the phones the desktop rig was never tuned for, so it gets the cheap
  // side of every WebGL knob: a lower device-pixel-ratio ceiling, no antialiasing, no stencil
  // buffer, the default (not high-performance) GPU preference, no shadow map, and two lights
  // instead of five.
  const lite = profile === 'lite';
  const warmedUp = useRef(false);

  useEffect(() => {
    // `active` mirrors `frameloop`: it flips from `false` to `true` every time the visitor resumes
    // from a pause or the tab regains focus, without unmounting this component. Keying this effect
    // on `active` (rather than running once at mount with `deps: []`) re-arms the grace period on
    // every one of those resumes, so the cold-start FPS dip it exists to ignore cannot reappear.
    if (!active) return;
    warmedUp.current = false;
    const timer = setTimeout(() => {
      warmedUp.current = true;
    }, PERFORMANCE_WARM_UP_MS);
    return () => clearTimeout(timer);
  }, [active]);

  const handleFallback = useCallback(() => {
    // Ignore samples taken during the warm-up window (see `PERFORMANCE_WARM_UP_MS`) — everything
    // looks slow while the GLB is still parsing and shaders are still compiling.
    if (!warmedUp.current) return;
    onDegrade();
  }, [onDegrade]);

  const handleContextLost = useCallback(() => {
    if (!warmedUp.current) return;
    onContextLost();
  }, [onContextLost]);

  return (
    <Canvas
      className="drone-canvas"
      aria-hidden="true"
      frameloop={active ? 'always' : 'never'}
      dpr={lite ? [0.75, 1] : [1, 1.25]}
      shadows={!lite}
      gl={
        lite
          ? { alpha: true, antialias: false, powerPreference: 'default', stencil: false }
          : { alpha: true, antialias: true, powerPreference: 'high-performance' }
      }
      // R3F's own `performance.min` defaults to 0.5, which is also left at its default here: below
      // that floor `AdaptiveDpr` would keep shrinking the render resolution into visibly blurry
      // territory before `onFallback` ever gets a chance to fire. `onFallback` (below) is the
      // actual safety valve — a scene bad enough to need more than a 2x resolution cut is a scene
      // that should be unmounted, not rendered small and mushy.
      onCreated={({ gl }) => {
        gl.outputColorSpace = SRGBColorSpace;
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
        if (!lite) {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = PCFSoftShadowMap;
        }
        // `PerformanceMonitor` below covers the gradual, measured case (frame times sagging) and
        // its verdict is worth persisting. A lost WebGL context is not a performance measurement —
        // a driver reset/update, the browser evicting a context under GPU/tab pressure, or a laptop
        // waking from sleep can all fire it on a perfectly capable desktop — so it degrades only
        // this session via `handleContextLost`, never `persistLowVerdict()`.
        gl.domElement.addEventListener('webglcontextlost', handleContextLost);
      }}
      camera={{ fov: 30, position: [0, CAMERA_Y, 6.2], near: 0.1, far: 100 }}
    >
      {lite ? (
        <>
          <ambientLight intensity={1.1} />
          <directionalLight position={[3, 4, 5]} intensity={1.6} color="#fff5ec" />
        </>
      ) : (
        <>
          <ambientLight intensity={0.48} color="#dce9f3" />
          <hemisphereLight args={['#f8fbff', '#17242c', 1.15]} />
          <directionalLight castShadow position={[-3.5, 4.5, 5]} intensity={3.1} color="#fff5ec" />
          <directionalLight position={[4, 1.5, -2]} intensity={1.35} color="#96c2d5" />
          <pointLight position={[0, -2, 3]} intensity={0.65} color="#d8e7f0" distance={10} />
        </>
      )}
      <PerformanceMonitor onFallback={handleFallback}>
        <AdaptiveDpr />
        <AdaptiveEvents />
        <Suspense fallback={null}>
          <DroneModel pointer={pointer} profile={profile} />
        </Suspense>
      </PerformanceMonitor>
    </Canvas>
  );
}

/**
 * Idle deferral for the lite canvas: even at ~220 KB gzip (225,635 bytes), fetching the GLB and
 * spinning up a WebGL context competes with the hero poster for the same first seconds that decide
 * LCP. Desktop's `full` profile has no such deferral — it already gated behind the desktop
 * breakpoint, a much larger and less battery-constrained device budget. Waiting for
 * `readyState === 'complete'` means the rest of the page's critical work is done; waiting for an
 * idle callback on top of that (falling back to a flat 200ms if the browser has none) means the
 * mount does not compete with whatever that "complete" event itself triggers.
 */
function useDeferredCanvasMount(profile: DroneProfile) {
  // Never seeded from the first render: `getServerSnapshot()` in motion-context.tsx always reports
  // the "no motion" policy on both the server render and the client's hydration render, which
  // resolves to `profile === 'full'` regardless of the real device. A lazy `useState` initialiser
  // keyed off `profile` would read that always-full snapshot once and freeze — on a real lite
  // (mobile) device `ready` would start `true` and never revisit itself once `profile` settles to
  // 'lite', permanently skipping the readyState/idle deferral this hook exists to provide. Instead
  // `ready` starts `false` and an effect derives the real value once `profile` is trustworthy.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (profile !== 'lite') {
      setReady(true);
      return;
    }
    setReady(false);
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const cancelIdle = (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
    const requestIdle = (window as Window & { requestIdleCallback?: (cb: IdleRequestCallback) => number })
      .requestIdleCallback;

    const scheduleIdle = () => {
      if (typeof requestIdle === 'function') idleId = requestIdle(() => setReady(true));
      else timeoutId = setTimeout(() => setReady(true), 200);
    };

    let removeLoadListener = () => {};
    if (document.readyState === 'complete') {
      scheduleIdle();
    } else {
      const onLoad = () => scheduleIdle();
      window.addEventListener('load', onLoad, { once: true });
      removeLoadListener = () => window.removeEventListener('load', onLoad);
    }

    return () => {
      removeLoadListener();
      if (idleId !== undefined) cancelIdle?.(idleId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [profile]);

  return ready;
}

export function DroneScene() {
  const { paused, capabilityTier } = useMotion();
  // Both the full (desktop) and lite (mobile) profiles fly the scroll now — only `none` (reduced
  // motion, Save-Data, or a failed performance verdict) renders nothing.
  //
  // WCAG 2.2.2 (Level A): the hero's pause control must be able to stop this animation, and
  // README.md's "Media behavior" section documents that it does. "Stopping" the drone means
  // freezing it in place (frameloop='never') rather than tearing it down, so resuming is instant
  // and the composition does not jump. That is why eligibility reads `capabilityTier`, which
  // ignores the pause: a pause must not unmount the canvas, but reduced motion, Save-Data, or a
  // performance verdict changing mid-session must, because those say the session can no longer
  // run the drone at all.
  const eligible = capabilityTier !== 'none';
  const profile: DroneProfile = capabilityTier === 'lite' ? 'lite' : 'full';

  // If motion was already turned off before this component ever mounted, there is no running
  // drone to preserve by freezing — mounting one anyway would just pay for the GLB fetch and a
  // WebGL context to show a drone nobody asked to see. `everMounted` tracks whether *this session*
  // has ever actually computed `mountable === true`, rather than capturing `paused` from a single
  // render: `getServerSnapshot()` in motion-context.tsx always reports the "no motion" policy on
  // the render React uses for hydration, so the real, settled values (including a persisted
  // `aele:motion=off`) only arrive on a later render. A `useRef(paused).current` initialiser reads
  // its argument once, on the render that creates the ref — the lying one — and can never see that
  // later, truthful `paused`. `everMounted` has no such blind spot: as long as it is still `false`,
  // any `paused === true` (whenever it becomes known) keeps the scene unmounted; once the session
  // has genuinely run the drone at least once, a later pause correctly freezes rather than
  // unmounts. `eligible` stays ANDed unconditionally, so a real capability loss (reduced motion,
  // Save-Data, a failed performance verdict) still unmounts regardless of `everMounted` — this is
  // not the one-way "stays visible forever" latch that caused a prior bug.
  const everMounted = useRef(false);

  // A low verdict from a previous session (see `readLowVerdict`) means this device — or this
  // scene, if `DRONE_TIER_VERSION` has moved on since — already failed to run the drone. Lazily
  // initialised so the check runs once, on mount, rather than on every render.
  const [perfDegraded, setPerfDegraded] = useState(() => readLowVerdict() !== null);
  const handleDegrade = useCallback(() => {
    persistLowVerdict();
    setPerfDegraded(true);
  }, []);
  // A lost WebGL context is not a performance measurement (see `SceneCanvas`'s comment on
  // `handleContextLost`) — it degrades this session only, never the persisted 30-day verdict.
  const handleContextLost = useCallback(() => {
    setPerfDegraded(true);
  }, []);

  const mountable = eligible && !perfDegraded && (!paused || everMounted.current);
  useEffect(() => {
    if (mountable) everMounted.current = true;
  }, [mountable]);

  const [visible, setVisible] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(true);
  const pointer = useRef({ x: 0, y: 0 });
  // Visibility (in viewport, tab focused) is independent of the pause state: a paused drone stays
  // on screen, just motionless.
  const visuallyActive = mountable && visible && documentVisible;
  const running = visuallyActive && !paused;
  const canvasReady = useDeferredCanvasMount(profile);

  // A callback ref rather than `useRef` + a `useEffect` with `deps: []`: the lying first (SSR
  // hydration) render always has `mountable === false` (see the shared root cause), so the
  // component returns `null` and `sceneRef.current` would be `null` the one and only time a
  // `[]`-effect ever runs — it bails out immediately and never retries once the element actually
  // appears on a later render. React invokes a callback ref every time the underlying DOM node is
  // attached or detached, so this re-attaches the observer on every real mount instead of just the
  // first, permanently-null one.
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sceneRefCallback = useCallback((element: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? true),
      { threshold: 0, rootMargin: '120px' },
    );
    observer.observe(element);
    observerRef.current = observer;
  }, []);

  useEffect(() => {
    const onVisibility = () => setDocumentVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    // Touch devices have no pointer worth reacting to, so the lite profile never pays for a
    // global pointermove listener at all — one more thing mobile does not need to track. The
    // gimbal on lite just holds `pointerLook`'s rest position ({ x: 0, y: 0 } — see `pointer`'s
    // initial value above), same as flight before the first pointer event ever arrives on desktop.
    if (!running || profile !== 'full') return;
    const onPointerMove = (event: PointerEvent) => {
      pointer.current.x = clamp((event.clientX / window.innerWidth) * 2 - 1, -1, 1);
      pointer.current.y = clamp((event.clientY / window.innerHeight) * 2 - 1, -1, 1);
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [running, profile]);

  // No still stands in for the drone: under reduced motion, save-data, a failed performance
  // verdict, or motion already paused before mount, the page simply renders without it rather
  // than dropping a decorative photo over the copy.
  if (!mountable) return null;

  return (
    <div
      ref={sceneRefCallback}
      className="drone-scene"
      data-active={visuallyActive}
      aria-label="Dron 3D interactivo"
    >
      {canvasReady && (
        <SceneCanvas
          active={running}
          pointer={pointer}
          profile={profile}
          onDegrade={handleDegrade}
          onContextLost={handleContextLost}
        />
      )}
    </div>
  );
}
