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
    const root = nodes.root;
    const yaw = nodes.yaw;
    const pitch = nodes.pitch;
    const targetYaw = pointer.current.x * 0.22;
    const targetPitch = -pointer.current.y * 0.14;

    root.position.y = damp(root.position.y, -0.16 + progress * 0.52, 2.4, delta);
    root.rotation.x = damp(root.rotation.x, 0.05 + progress * 0.08, 2.4, delta);
    root.rotation.y = damp(root.rotation.y, -0.15 + progress * 0.48, 2.4, delta);
    root.rotation.z = damp(root.rotation.z, progress * -0.12, 2.4, delta);
    if (yaw) yaw.rotation.y = damp(yaw.rotation.y, targetYaw, 5, delta);
    if (pitch) pitch.rotation.x = damp(pitch.rotation.x, targetPitch, 5, delta);
    for (const [index, rotor] of nodes.rotors.entries()) {
      rotor.rotation.y += delta * (index % 2 === 0 ? 8 : -8) * (0.65 + progress * 0.35);
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
      camera={{ fov: 28, position: [0, 0.75, 4.8], near: 0.1, far: 100 }}
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
  const { paused, reduced, desktop, saveData } = useMotion();
  const eligible = desktop && !reduced && !saveData && !paused;
  const [visible, setVisible] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [heroStage, setHeroStage] = useState(true);
  const sceneRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const active = eligible && visible && documentVisible;

  useEffect(() => {
    const updateStage = () => setHeroStage(window.scrollY < window.innerHeight * 0.82);
    updateStage();
    window.addEventListener('scroll', updateStage, { passive: true });
    return () => window.removeEventListener('scroll', updateStage);
  }, []);

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
      data-stage={heroStage ? 'hero' : 'away'}
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
