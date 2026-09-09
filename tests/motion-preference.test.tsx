import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Every stateful test reloads the module fresh so the module-level localStorage cache
// (motion-context.tsx) never leaks a preference from one test into the next. resolveTier
// is pure and does not need this, but the provider tests below do.
beforeEach(() => {
  vi.resetModules();
});

async function loadMotionContext() {
  return import('../components/motion-context');
}

/** Builds a probe bound to a freshly (re)loaded motion-context module instance. */
function makeProbe(useMotion: typeof import('../components/motion-context').useMotion) {
  return function Probe() {
    const { preference, tier, setPreference } = useMotion();
    return (
      <div>
        <span data-testid="preference">{preference}</span>
        <span data-testid="tier">{tier}</span>
        <button onClick={() => setPreference('off')}>Pausar</button>
        <button onClick={() => setPreference('on')}>Reanudar</button>
      </div>
    );
  };
}

describe('resolveTier', () => {
  it.each<[string, Parameters<typeof import('../components/motion-context').resolveTier>[0], 'full' | 'lite' | 'none']>([
    ['off beats desktop', { reduced: false, desktop: true, saveData: false, preference: 'off' }, 'none'],
    ['on beats reduced', { reduced: true, desktop: true, saveData: false, preference: 'on' }, 'full'],
    ['on beats saveData', { reduced: false, desktop: false, saveData: true, preference: 'on' }, 'lite'],
    ['unset + reduced -> none', { reduced: true, desktop: true, saveData: false, preference: 'unset' }, 'none'],
    ['unset + !desktop -> lite', { reduced: false, desktop: false, saveData: false, preference: 'unset' }, 'lite'],
    ['unset + desktop -> full', { reduced: false, desktop: true, saveData: false, preference: 'unset' }, 'full'],
  ])('%s', async (_name, policy, expected) => {
    const { resolveTier } = await loadMotionContext();
    expect(resolveTier(policy)).toBe(expected);
  });
});

describe('MotionProvider preference persistence', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists the preference across mounts', async () => {
    const { MotionProvider, useMotion } = await loadMotionContext();
    const Probe = makeProbe(useMotion);
    const { unmount } = render(
      <MotionProvider>
        <Probe />
      </MotionProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    expect(screen.getByTestId('preference')).toHaveTextContent('off');
    unmount();

    render(
      <MotionProvider>
        <Probe />
      </MotionProvider>,
    );
    expect(screen.getByTestId('preference')).toHaveTextContent('off');
  });

  it('writes nothing to storage until the visitor acts', async () => {
    const { MotionProvider, useMotion } = await loadMotionContext();
    const Probe = makeProbe(useMotion);
    render(
      <MotionProvider>
        <Probe />
      </MotionProvider>,
    );
    expect(window.localStorage.length).toBe(0);
  });

  it('resolves getServerSnapshot to the no-motion value regardless of storage content', async () => {
    const { getServerSnapshot, STORAGE_KEY } = await loadMotionContext();
    window.localStorage.setItem(STORAGE_KEY, 'on');
    expect(getServerSnapshot()).toBe(1);
  });

  it('propagates a preference change written by another tab via the storage event', async () => {
    const { MotionProvider, useMotion, STORAGE_KEY } = await loadMotionContext();
    const Probe = makeProbe(useMotion);
    render(
      <MotionProvider>
        <Probe />
      </MotionProvider>,
    );
    expect(screen.getByTestId('preference')).toHaveTextContent('unset');

    window.localStorage.setItem(STORAGE_KEY, 'on');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: 'on' }));
    });

    expect(screen.getByTestId('preference')).toHaveTextContent('on');
  });

  it('resolves to unset when localStorage throws on read', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked in private mode');
    });
    const { MotionProvider, useMotion } = await loadMotionContext();
    const Probe = makeProbe(useMotion);
    render(
      <MotionProvider>
        <Probe />
      </MotionProvider>,
    );
    expect(screen.getByTestId('preference')).toHaveTextContent('unset');
  });
});
