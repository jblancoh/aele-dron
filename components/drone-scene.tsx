/* oxlint-disable react-compiler, next/no-img-element -- Three.js requires imperative scene mutations and the static fallback is a local precompressed asset. */
'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { Object3D } from 'three';
import { useMotion } from './motion-context';

const MODEL_URL = '/media/drone/aele-graphite-drone.glb';
const FALLBACK_URL = '/media/drone-gimbal.webp';
const ROTOR_NAMES = ['Rotor_FL', 'Rotor_FR', 'Rotor_RL', 'Rotor_RR'];

export type DroneWaypoint = {
  at: number;
  x: number;
  y: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
};

export const DRONE_WAYPOINTS: DroneWaypoint[] = [
  { at: 0, x: 0, y: 0.38, rotationX: 0.04, rotationY: -0.1, rotationZ: 0 },
  { at: 0.25, x: 1.5, y: 0.9, rotationX: 0.12, rotationY: 0.34, rotationZ: -0.1 },
  { at: 0.52, x: 1.35, y: 0.4, rotationX: -0.08, rotationY: -0.34, rotationZ: 0.12 },
  { at: 0.76, x: 1.2, y: 0.2, rotationX: 0.04, rotationY: 0.16, rotationZ: -0.08 },
  { at: 1, x: -0.78, y: -0.2, rotationX: 0.02, rotationY: -0.08, rotationZ: 0.03 },
];

export function interpolateWaypoints(progress: number) {
  const value = clamp(progress);
  const nextIndex = DRONE_WAYPOINTS.findIndex((waypoint) => waypoint.at >= value);
  if (nextIndex <= 0) return { ...DRONE_WAYPOINTS[0] };
  const from = DRONE_WAYPOINTS[nextIndex - 1];
  const to = DRONE_WAYPOINTS[nextIndex] ?? from;
  const span = Math.max(0.0001, to.at - from.at);
  const t = (value - from.at) / span;
  return {
    at: value,
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    rotationX: from.rotationX + (to.rotationX - from.rotationX) * t,
    rotationY: from.rotationY + (to.rotationY - from.rotationY) * t,
    rotationZ: from.rotationZ + (to.rotationZ - from.rotationZ) * t,
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
  const scrollProgress = useRef(0);
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
    const updateScroll = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      scrollProgress.current = clamp(window.scrollY / maxScroll);
    };
    updateScroll();
    window.addEventListener('scroll', updateScroll, { passive: true });
    return () => window.removeEventListener('scroll', updateScroll);
  }, []);

  useFrame((_, delta) => {
    const progress = scrollProgress.current;
    const target = interpolateWaypoints(progress);
    const root = nodes.root;
    const yaw = nodes.yaw;
    const pitch = nodes.pitch;
    const targetYaw = pointer.current.x * 0.22;
    const targetPitch = -pointer.current.y * 0.14;

    root.position.x = damp(root.position.x, target.x, 2.8, delta);
    root.position.y = damp(root.position.y, target.y, 2.8, delta);
    root.rotation.x = damp(root.rotation.x, target.rotationX, 2.8, delta);
    root.rotation.y = damp(root.rotation.y, target.rotationY, 2.8, delta);
    root.rotation.z = damp(root.rotation.z, target.rotationZ, 2.8, delta);
    if (yaw) yaw.rotation.y = damp(yaw.rotation.y, targetYaw, 5, delta);
    if (pitch) pitch.rotation.x = damp(pitch.rotation.x, targetPitch, 5, delta);
    const flightSpeed = progress > 0.88 ? 0 : 28 * (0.8 + progress * 0.2);
    for (const [index, rotor] of nodes.rotors.entries()) {
      rotor.rotation.y += delta * (index % 2 === 0 ? flightSpeed : -flightSpeed);
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
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 30, position: [0, 0.75, 6.2], near: 0.1, far: 100 }}
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

  return (
    <div
      ref={sceneRef}
      className="drone-scene"
      data-active={active}
      aria-label="Dron 3D interactivo"
    >
      {eligible ? (
        <SceneCanvas active={active} pointer={pointer} />
      ) : (
        <img
          className="drone-fallback"
          src={FALLBACK_URL}
          width={640}
          height={480}
          alt="Detalle de cámara de dron AELE"
          loading="lazy"
        />
      )}
    </div>
  );
}
