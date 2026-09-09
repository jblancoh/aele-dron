import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DroneScene, interpolateWaypoints } from '../components/drone-scene';

const motion = { paused: false, reduced: false, desktop: false, saveData: false };
vi.mock('../components/motion-context', () => ({ useMotion: () => motion }));
vi.mock('@react-three/fiber', () => ({ Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="drone-canvas">{children}</div>, useFrame: () => undefined }));
vi.mock('@react-three/drei', () => ({ useGLTF: Object.assign(() => ({ scene: { getObjectByName: () => undefined } }), { preload: () => undefined }) }));

afterEach(() => {
  motion.desktop = false;
  motion.paused = false;
  motion.reduced = false;
  motion.saveData = false;
});

describe('DroneScene', () => {
  it('uses the accessible static fallback when motion is not eligible', () => {
    render(<DroneScene />);
    expect(screen.queryByTestId('drone-canvas')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: /detalle de cámara/i })).toHaveAttribute('src', '/media/drone-gimbal.webp');
  });

  it('keeps the drone active when the hero motion control is paused', () => {
    motion.desktop = true;
    motion.paused = true;
    render(<DroneScene />);
    expect(screen.getByTestId('drone-canvas')).toBeInTheDocument();
  });

  it('interpolates continuous scroll waypoints instead of snapping stages', () => {
    const start = interpolateWaypoints(0);
    const middle = interpolateWaypoints(0.36);
    const end = interpolateWaypoints(1);
    expect(start.x).toBeCloseTo(0.48);
    expect(middle.x).toBeGreaterThan(0);
    expect(end.x).toBeCloseTo(0.28);
    expect(middle.y).not.toBe(start.y);
    expect(middle.y).not.toBe(end.y);
  });
});
