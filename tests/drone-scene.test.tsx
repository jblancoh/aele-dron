import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DroneScene } from '../components/drone-scene';

const motion = { paused: false, reduced: false, desktop: false, saveData: false };
vi.mock('../components/motion-context', () => ({ useMotion: () => motion }));
vi.mock('@react-three/fiber', () => ({ Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="drone-canvas">{children}</div>, useFrame: () => undefined }));
vi.mock('@react-three/drei', () => ({ useGLTF: Object.assign(() => ({ scene: { getObjectByName: () => undefined } }), { preload: () => undefined }) }));

describe('DroneScene', () => {
  it('uses the accessible static fallback when motion is not eligible', () => {
    render(<DroneScene />);
    expect(screen.queryByTestId('drone-canvas')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: /detalle de cámara/i })).toHaveAttribute('src', '/media/drone-gimbal.webp');
  });

  it('renders the WebGL canvas for an eligible desktop session', () => {
    motion.desktop = true;
    render(<DroneScene />);
    expect(screen.getByTestId('drone-canvas')).toBeInTheDocument();
    motion.desktop = false;
  });
});
