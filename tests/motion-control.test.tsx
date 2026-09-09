import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MotionProvider } from '../components/motion-context';
import { HeroVideo } from '../components/hero-video';
import { DroneScene } from '../components/drone-scene';

// Real motion-context is used here (unlike tests/drone-scene.test.tsx) so the pause control's
// keyboard behaviour and its effect on the drone are tested end to end, through the actual
// MotionProvider rather than a static mock.
const threeState = { viewport: { width: 10, height: 6 }, size: { width: 1000, height: 600 } };
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, frameloop }: { children: React.ReactNode; frameloop?: string }) => (
    <div data-testid="drone-canvas" data-frameloop={frameloop}>
      {children}
    </div>
  ),
  useFrame: () => undefined,
  useThree: (selector?: (state: typeof threeState) => unknown) => (selector ? selector(threeState) : threeState),
}));
vi.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(vi.fn(() => ({ scene: { getObjectByName: () => undefined } })), { preload: () => undefined }),
  PerformanceMonitor: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  AdaptiveDpr: () => null,
  AdaptiveEvents: () => null,
}));

function mediaQuery(reduced: boolean, desktop: boolean) {
  vi.mocked(window.matchMedia).mockImplementation((query) => ({
    matches: query.includes('prefers-reduced') ? reduced : desktop,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => vi.clearAllMocks());

describe('pause control accessibility (WCAG 2.2.2)', () => {
  it('is operable by keyboard: Enter freezes the drone, Space resumes it', async () => {
    mediaQuery(false, true); // not reduced, desktop -> tier 'full'
    const user = userEvent.setup();
    render(
      <MotionProvider>
        <HeroVideo />
        <DroneScene />
      </MotionProvider>,
    );

    expect(screen.getByTestId('drone-canvas')).toHaveAttribute('data-frameloop', 'always');

    await user.tab();
    const button = screen.getByRole('button', { name: 'Pausar movimiento' });
    expect(button).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Reanudar movimiento' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('drone-canvas')).toHaveAttribute('data-frameloop', 'never');

    await user.keyboard(' ');
    expect(screen.getByRole('button', { name: 'Pausar movimiento' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('drone-canvas')).toHaveAttribute('data-frameloop', 'always');
  });

  it('keeps the pause toggle reachable on the lite tier, even though the drone itself does not mount yet', () => {
    mediaQuery(false, false); // not reduced, not desktop -> tier 'lite'
    render(
      <MotionProvider>
        <HeroVideo />
        <DroneScene />
      </MotionProvider>,
    );
    expect(screen.getByRole('button', { name: 'Pausar movimiento' })).toBeInTheDocument();
    // The bounded/lite drone mode is a later phase — nothing to freeze yet on this tier.
    expect(screen.queryByTestId('drone-canvas')).not.toBeInTheDocument();
  });
});
