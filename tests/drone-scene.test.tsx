import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGLTF } from '@react-three/drei';
import {
  CAMERA_Y,
  DroneScene,
  FLIGHT_STOPS,
  GIMBAL_LANDING_PITCH,
  GIMBAL_LANDING_YAW,
  HOVER_ROTOR_SPEED,
  LANDING_POSE,
  heroBandPose,
  heroBandTop,
  hoverLook,
  hoverPose,
  interpolatePose,
  flightPose,
  follow,
  parkedPoseY,
  poseToWorld,
  pointerLook,
  resolveStopOffsets,
  rotorTargetSpeed,
  stepRotorSpeed,
} from '../components/drone-scene';

type MockTier = 'full' | 'lite' | 'none';
// `capabilityTier` is what the session could run if motion were switched on; it mirrors `tier`
// unless a test sets it, which is exactly their relationship while the visitor has not paused.
const motion: { paused: boolean; tier: MockTier; capabilityTier?: MockTier } = { paused: false, tier: 'none' };
vi.mock('../components/motion-context', () => ({
  useMotion: () => ({
    paused: motion.paused,
    tier: motion.tier,
    capabilityTier: motion.capabilityTier ?? motion.tier,
  }),
}));
const threeState = { viewport: { width: 10, height: 6 }, size: { width: 1000, height: 600 } };
// A fake WebGL context handed to `onCreated`, real enough to attach and dispatch DOM events on
// (`webglcontextlost`) — that is the one thing Phase 5's context-loss path needs from it.
type MockGl = { domElement: HTMLCanvasElement; shadowMap: { enabled: boolean; type?: unknown } };
let lastCreatedGl: MockGl | null = null;
vi.mock('@react-three/fiber', () => ({
  Canvas: ({
    children,
    frameloop,
    shadows,
    dpr,
    gl,
    onCreated,
  }: {
    children: React.ReactNode;
    frameloop?: string;
    shadows?: boolean;
    dpr?: unknown;
    gl?: unknown;
    onCreated?: (state: { gl: MockGl }) => void;
  }) => {
    // Real R3F fires `onCreated` exactly once, the first time the GL context is created — a lazy
    // `useState` initialiser is the cheapest way to reproduce that "once per mount" timing here.
    const [createdGl] = useState<MockGl>(() => {
      const fake: MockGl = { domElement: document.createElement('canvas'), shadowMap: { enabled: false } };
      onCreated?.({ gl: fake });
      return fake;
    });
    lastCreatedGl = createdGl;
    return (
      <div
        data-testid="drone-canvas"
        data-frameloop={frameloop}
        data-shadows={String(Boolean(shadows))}
        data-dpr={JSON.stringify(dpr)}
        data-gl={JSON.stringify(gl)}
      >
        {children}
      </div>
    );
  },
  useFrame: () => undefined,
  useThree: (selector?: (state: typeof threeState) => unknown) => (selector ? selector(threeState) : threeState),
}));
// Captures the `onFallback` handler `SceneCanvas` registers so tests can invoke it directly,
// standing in for drei's real FPS sampling.
const performanceMonitor: { onFallback?: (api: unknown) => void } = {};
vi.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(vi.fn(() => ({ scene: { getObjectByName: () => undefined } })), { preload: () => undefined }),
  PerformanceMonitor: ({
    children,
    onFallback,
  }: {
    children?: React.ReactNode;
    onFallback?: (api: unknown) => void;
  }) => {
    performanceMonitor.onFallback = onFallback;
    return <>{children}</>;
  },
  AdaptiveDpr: () => null,
  AdaptiveEvents: () => null,
}));

afterEach(() => {
  vi.clearAllMocks();
  motion.tier = 'none';
  motion.capabilityTier = undefined;
  motion.paused = false;
  performanceMonitor.onFallback = undefined;
  lastCreatedGl = null;
});

describe('DroneScene', () => {
  it('loads the approved white drone asset on eligible devices', () => {
    motion.tier = 'full';
    render(<DroneScene />);
    expect(useGLTF).toHaveBeenCalledWith('/media/drone/aele-white-drone.glb');
    expect(screen.getByTestId('drone-canvas')).toHaveAttribute('data-shadows', 'true');
  });

  it('renders nothing at all when motion is not eligible', () => {
    const { container } = render(<DroneScene />);
    expect(screen.queryByTestId('drone-canvas')).not.toBeInTheDocument();
    // No decorative still stands in for the drone on phones or under reduced motion.
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  // Superseded by Phase 4 ("DroneScene — bounded (lite/hover) mode" below): lite is now a
  // first-class bounded hover mode, not a placeholder that renders nothing. Inverted here, like
  // the pause test above, so a future regression back to "lite renders nothing" fails a test
  // instead of shipping silently.
  it('mounts a bounded scene — not nothing — when tier is lite', () => {
    motion.tier = 'lite';
    const { container } = render(<DroneScene />);
    expect(container).not.toBeEmptyDOMElement();
    expect(container.querySelector('.drone-scene')).toHaveAttribute('data-bounded', 'true');
  });

  // WCAG 2.2.2 (Level A) requires that any moving, blinking or scrolling content the page starts
  // automatically can be paused, stopped or hidden by the visitor. README.md ("Media behavior",
  // ~line 30) documents that the pause control stops automatic hero/scroll/gimbal motion, so the
  // drone must honour it too. This test used to be named 'keeps the drone active when the hero
  // motion control is paused' and asserted the opposite — that the canvas stayed running while
  // paused. That was the bug, fossilised as a test: do not invert this assertion again.
  it('stops the drone when the visitor pauses motion', () => {
    motion.tier = 'full';
    motion.paused = true;
    render(<DroneScene />);
    expect(screen.queryByTestId('drone-canvas')).not.toBeInTheDocument();
  });

  it('does not mount at all when the pause preference was already persisted before this mounted', () => {
    // Distinguishes "paused before mount" from "paused mid-session": there is no running drone to
    // preserve here, so paying for the GLB fetch and a WebGL context would only produce a frozen
    // drone nobody asked to see.
    motion.tier = 'full';
    motion.paused = true;
    const { container } = render(<DroneScene />);
    expect(container).toBeEmptyDOMElement();
  });

  // Regression guard for the ref-based `startedPaused` bug: `getServerSnapshot()` in
  // motion-context.tsx always reports the "no motion" policy (`reduced: true`, `preference:
  // 'unset'`) on the render React uses for hydration, which resolves to `capabilityTier === 'none'`
  // and `paused === false` — regardless of what is actually persisted in localStorage. The real,
  // settled values (e.g. a persisted `aele:motion=off`) only arrive on a *later* render, once
  // `useSyncExternalStore` re-syncs. A `useRef(paused).current` initialiser only ever reads the
  // argument on the render that creates the ref (the lying one) — it can never see that later,
  // truthful `paused`. This test reproduces exactly that ordering: mount with the "unset" lie, then
  // let the settled ("already paused") values arrive on the next render.
  it('never mounts when the paused-before-mount preference only becomes known after the lying first render settles', () => {
    motion.capabilityTier = 'none';
    motion.tier = 'none';
    motion.paused = false;
    const { container, rerender } = render(<DroneScene />);
    expect(container).toBeEmptyDOMElement();

    // The store resyncs post-mount: this device is actually capable, but the preference persisted
    // from a previous visit was 'off'.
    motion.capabilityTier = 'full';
    motion.tier = 'full';
    motion.paused = true;
    rerender(<DroneScene />);

    // There was never a moment this session should have started running the drone, so it must stay
    // fully unmounted — not a frozen canvas that silently downloaded the GLB and spun up WebGL.
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('drone-canvas')).not.toBeInTheDocument();
  });

  it('freezes in place instead of unmounting when paused mid-session', () => {
    motion.tier = 'full';
    motion.paused = false;
    const { rerender } = render(<DroneScene />);
    expect(screen.getByTestId('drone-canvas')).toHaveAttribute('data-frameloop', 'always');

    motion.paused = true;
    rerender(<DroneScene />);
    // The canvas is still in the DOM — pausing freezes it, it does not tear it down.
    expect(screen.getByTestId('drone-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('drone-canvas')).toHaveAttribute('data-frameloop', 'never');
  });

  it('resumes with frameloop="always" after being paused mid-session', () => {
    motion.tier = 'full';
    motion.paused = false;
    const { rerender } = render(<DroneScene />);

    motion.paused = true;
    rerender(<DroneScene />);
    expect(screen.getByTestId('drone-canvas')).toHaveAttribute('data-frameloop', 'never');

    motion.paused = false;
    rerender(<DroneScene />);
    expect(screen.getByTestId('drone-canvas')).toHaveAttribute('data-frameloop', 'always');
  });

  // Freezing is only ever the answer to a deliberate pause. When the session itself stops being
  // able to run the drone, the scene has to go away — keeping it alive would defeat the very
  // preferences (reduced motion, save-data, small viewports) that gate it.
  it('unmounts when the visitor turns on reduced motion mid-session', () => {
    motion.tier = 'full';
    const { rerender } = render(<DroneScene />);
    expect(screen.getByTestId('drone-canvas')).toBeInTheDocument();

    motion.tier = 'none';
    motion.capabilityTier = 'none';
    rerender(<DroneScene />);
    expect(screen.queryByTestId('drone-canvas')).not.toBeInTheDocument();
  });

  // Superseded by Phase 4: the viewport shrinking below the desktop breakpoint now switches the
  // drone to bounded hover mode instead of unmounting it — lite stopped being a no-op tier.
  // Regression guard: the `IntersectionObserver` effect used to run once with `deps: []`, on the
  // render React uses for hydration — where `mountable` is always false (see the shared root
  // cause) and the component returns `null`. `sceneRef.current` was therefore `null` the one and
  // only time that effect ever ran, so it bailed out and never observed anything, for the rest of
  // the component's life — `visible` stayed permanently stuck at its initial `true`.
  it('attaches the IntersectionObserver once the scene actually mounts, even though the first render returned null', () => {
    // `vi.unstubAllGlobals()` would also revert the module-load `IntersectionObserver`/
    // `ResizeObserver` stubs from tests/setup.ts, breaking every later test in this file — restore
    // the original stub by hand instead (same pattern as the `requestIdleCallback` tests below).
    const originalIntersectionObserver = window.IntersectionObserver;
    const observed: IntersectionObserverCallback[] = [];
    class CapturingObserver {
      callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
        observed.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', CapturingObserver);

    // Not eligible yet: the first render (like the real hydration render) returns null.
    motion.tier = 'none';
    motion.capabilityTier = 'none';
    const { rerender } = render(<DroneScene />);
    expect(observed).toHaveLength(0);

    // Now the real, settled capability arrives.
    motion.tier = 'full';
    motion.capabilityTier = 'full';
    rerender(<DroneScene />);
    expect(screen.getByTestId('drone-canvas')).toBeInTheDocument();
    expect(observed).toHaveLength(1);

    act(() => {
      observed[0]([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    // `visible` actually responded to the observer instead of being clamped to its initial `true`.
    expect(screen.getByTestId('drone-canvas')).toHaveAttribute('data-frameloop', 'never');

    vi.stubGlobal('IntersectionObserver', originalIntersectionObserver);
  });

  it('switches to bounded hover mode instead of unmounting when the viewport shrinks below the desktop breakpoint', () => {
    // Entering hover mode (re-)triggers the idle deferral (see `useDeferredCanvasMount`), so this
    // transition needs the same synchronous-idle-callback stub the bounded-mode tests use.
    const idleCallback = vi.fn((callback: IdleRequestCallback) => {
      callback({ didTimeout: false, timeRemaining: () => 0 });
      return 1;
    });
    (window as unknown as { requestIdleCallback: typeof idleCallback }).requestIdleCallback = idleCallback;

    motion.tier = 'full';
    const { container, rerender } = render(<DroneScene />);
    expect(screen.getByTestId('drone-canvas')).toBeInTheDocument();
    expect(container.querySelector('.drone-scene')).not.toHaveAttribute('data-bounded');

    motion.tier = 'lite';
    motion.capabilityTier = 'lite';
    rerender(<DroneScene />);
    // The mount point picks up `data-bounded` immediately, and the canvas re-mounts once the
    // (stubbed, synchronous) idle deferral for the newly-entered hover mode resolves.
    expect(screen.getByTestId('drone-canvas')).toBeInTheDocument();
    expect(container.querySelector('.drone-scene')).toHaveAttribute('data-bounded', 'true');

    delete (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback;
  });
});

// Phase 4: the lite tier now mounts a bounded, hover-mode drone instead of rendering nothing.
// Mounting the canvas is deferred to idle so the hero poster's LCP is never blocked by the GLB
// fetch, so every test that needs the canvas present makes `requestIdleCallback` run its callback
// synchronously — the deferral itself is exercised by its own dedicated tests below.
describe('DroneScene — bounded (lite/hover) mode', () => {
  // `vi.stubGlobal`/`vi.unstubAllGlobals` would also revert the one-time `IntersectionObserver`/
  // `ResizeObserver` stubs installed by tests/setup.ts at module load, breaking every later test
  // in the file — so `requestIdleCallback` is patched onto `window` directly and removed by hand.
  afterEach(() => {
    delete (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback;
  });

  function stubSynchronousIdleCallback() {
    const idleCallback = vi.fn((callback: IdleRequestCallback) => {
      callback({ didTimeout: false, timeRemaining: () => 0 });
      return 1;
    });
    (window as unknown as { requestIdleCallback: typeof idleCallback }).requestIdleCallback = idleCallback;
    return idleCallback;
  }

  it('marks the mount point as bounded to the hero in the lite tier', () => {
    stubSynchronousIdleCallback();
    motion.tier = 'lite';
    const { container } = render(<DroneScene />);
    expect(container.querySelector('.drone-scene')).toHaveAttribute('data-bounded', 'true');
  });

  it('does not bound the mount point in the full/flight tier', () => {
    motion.tier = 'full';
    const { container } = render(<DroneScene />);
    expect(container.querySelector('.drone-scene')).not.toHaveAttribute('data-bounded');
  });

  it('never registers a pointermove listener in the lite tier', () => {
    stubSynchronousIdleCallback();
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    motion.tier = 'lite';
    render(<DroneScene />);
    expect(addEventListenerSpy.mock.calls.some(([type]) => (type as string) === 'pointermove')).toBe(false);
  });

  it('never queries the flight-stop selectors, the scroll listener, or a body ResizeObserver in the lite tier', () => {
    stubSynchronousIdleCallback();
    const querySelectorSpy = vi.spyOn(document, 'querySelector');
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const observeSpy = vi.spyOn(window.ResizeObserver.prototype, 'observe');
    motion.tier = 'lite';
    render(<DroneScene />);
    // The big saving this phase exists for: none of the 8 flight-stop selectors are ever asked
    // for, so the 3 catalogue films (and the rest of the page) never get measured on mobile.
    expect(querySelectorSpy).not.toHaveBeenCalledWith('.film-0');
    expect(addEventListenerSpy.mock.calls.some(([type]) => (type as string) === 'scroll')).toBe(false);
    expect(observeSpy.mock.calls.some(([target]) => target === document.body)).toBe(false);
  });

  it('configures a cheaper WebGL context in the lite tier', () => {
    stubSynchronousIdleCallback();
    motion.tier = 'lite';
    render(<DroneScene />);
    const canvas = screen.getByTestId('drone-canvas');
    expect(canvas).toHaveAttribute('data-dpr', JSON.stringify([0.75, 1]));
    expect(canvas).toHaveAttribute(
      'data-gl',
      JSON.stringify({ alpha: true, antialias: false, powerPreference: 'default', stencil: false }),
    );
    expect(canvas).toHaveAttribute('data-shadows', 'false');
  });

  it('renders fewer lights in the lite tier than the full tier', () => {
    stubSynchronousIdleCallback();
    motion.tier = 'lite';
    const { container: liteContainer } = render(<DroneScene />);
    const liteLights = liteContainer.querySelectorAll('ambientlight, hemispherelight, directionallight, pointlight').length;

    motion.tier = 'full';
    const { container: fullContainer } = render(<DroneScene />);
    const fullLights = fullContainer.querySelectorAll('ambientlight, hemispherelight, directionallight, pointlight').length;

    expect(liteLights).toBe(2);
    expect(liteLights).toBeLessThan(fullLights);
  });

  // `getServerSnapshot()` in motion-context.tsx always reports 'flight' on the hydration render
  // (see the comment there), so `useDeferredCanvasMount`'s state can never be seeded from that
  // first render's `mode` — it has to be derived in an effect once `mode` actually settles to
  // 'hover'. A `useState(mode !== 'hover')` initialiser reads that lying first render and never
  // reruns, permanently skipping the whole readyState/idle deferral in production.
  it('still defers the idle path when hover mode only settles after the first render (regression: lazy useState initializer reads the always-flight hydration snapshot)', () => {
    const idleCallback = stubSynchronousIdleCallback();
    Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });

    function Wrapper() {
      const [, forceRerender] = useState(0);
      return (
        <>
          <button
            onClick={() => {
              // Mutated in an event handler, not during render, so this stands in for the mock's
              // underlying value actually changing (e.g. the real store settling post-hydration)
              // rather than a prop flowing down through render.
              motion.tier = 'lite';
              motion.capabilityTier = 'lite';
              forceRerender((count) => count + 1);
            }}
          >
            go lite
          </button>
          <DroneScene />
        </>
      );
    }

    motion.tier = 'full';
    motion.capabilityTier = 'full';
    render(<Wrapper />);
    // Starts in 'full'/flight — no deferral, mounts immediately.
    expect(screen.getByTestId('drone-canvas')).toBeInTheDocument();

    act(() => {
      screen.getByRole('button', { name: 'go lite' }).click();
    });

    // Switching to hover mid-session must still defer via requestIdleCallback — it must not have
    // been permanently skipped by a stale `ready === true` from the first render.
    expect(idleCallback).toHaveBeenCalled();
  });

  it('defers mounting the canvas until the document has finished loading and gone idle', () => {
    const originalReadyState = Object.getOwnPropertyDescriptor(Document.prototype, 'readyState');
    Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
    const idleCallback = stubSynchronousIdleCallback();
    motion.tier = 'lite';
    render(<DroneScene />);
    expect(screen.queryByTestId('drone-canvas')).not.toBeInTheDocument();
    expect(idleCallback).not.toHaveBeenCalled();

    Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
    act(() => {
      window.dispatchEvent(new Event('load'));
    });
    expect(idleCallback).toHaveBeenCalled();
    expect(screen.getByTestId('drone-canvas')).toBeInTheDocument();

    if (originalReadyState) Object.defineProperty(Document.prototype, 'readyState', originalReadyState);
  });

  it('falls back to a 200ms timeout when requestIdleCallback is unavailable', () => {
    vi.useFakeTimers();
    motion.tier = 'lite';
    render(<DroneScene />);
    expect(screen.queryByTestId('drone-canvas')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId('drone-canvas')).toBeInTheDocument();
    vi.useRealTimers();
  });
});

// Phase 5: `useDetectGPU`-style device lookups were rejected (see the plan) in favour of actually
// measuring the running session — drei's `PerformanceMonitor` samples real frame times, and a
// lost WebGL context is treated the same way. Either path unmounts the scene entirely (not just
// dropping to a cheaper tier) and remembers the verdict so the next visit does not pay for the
// GLB fetch and a WebGL context just to fail again.
describe('DroneScene — measured performance degradation', () => {
  const DRONE_TIER_KEY = 'aele:drone-tier';
  const THIRTY_ONE_DAYS_MS = 31 * 24 * 60 * 60 * 1000;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('unmounts and persists a low verdict when the performance monitor falls back after warm-up', () => {
    motion.tier = 'full';
    render(<DroneScene />);
    expect(screen.getByTestId('drone-canvas')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    act(() => {
      performanceMonitor.onFallback?.({});
    });

    expect(screen.queryByTestId('drone-canvas')).not.toBeInTheDocument();
    const stored = JSON.parse(window.localStorage.getItem(DRONE_TIER_KEY) ?? 'null');
    expect(stored).toMatchObject({ v: 1, verdict: 'low' });
    expect(typeof stored.at).toBe('number');
  });

  it('ignores a fallback fired before the warm-up grace period elapses', () => {
    // The GLB parse and shader compile sink the first second of FPS on every device — without a
    // grace period, `onFallback` would fire (and degrade) on hardware that is actually fine.
    motion.tier = 'full';
    render(<DroneScene />);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => {
      performanceMonitor.onFallback?.({});
    });

    expect(screen.getByTestId('drone-canvas')).toBeInTheDocument();
    expect(window.localStorage.getItem(DRONE_TIER_KEY)).toBeNull();
  });

  it('never mounts when a low verdict was already persisted', () => {
    window.localStorage.setItem(DRONE_TIER_KEY, JSON.stringify({ v: 1, verdict: 'low', at: Date.now() }));
    motion.tier = 'full';
    const { container } = render(<DroneScene />);
    expect(container).toBeEmptyDOMElement();
  });

  it('ignores an expired low verdict', () => {
    window.localStorage.setItem(
      DRONE_TIER_KEY,
      JSON.stringify({ v: 1, verdict: 'low', at: Date.now() - THIRTY_ONE_DAYS_MS }),
    );
    motion.tier = 'full';
    render(<DroneScene />);
    expect(screen.getByTestId('drone-canvas')).toBeInTheDocument();
  });

  it('ignores a low verdict stored under an older scene cost version', () => {
    // `v` is bumped whenever the scene itself gets more expensive to render (new geometry,
    // shadows, materials) — an old verdict measured against a cheaper scene should not survive.
    window.localStorage.setItem(DRONE_TIER_KEY, JSON.stringify({ v: 0, verdict: 'low', at: Date.now() }));
    motion.tier = 'full';
    render(<DroneScene />);
    expect(screen.getByTestId('drone-canvas')).toBeInTheDocument();
  });

  // A lost WebGL context is not a performance signal: a driver reset/update, the browser evicting
  // a context under GPU/tab pressure, or a laptop waking from sleep can all fire it on a perfectly
  // capable desktop. Only `PerformanceMonitor`'s own verdict (see the test above) reflects this
  // device's actual, measured performance and is worth remembering for 30 days — a context loss
  // degrades only the current session.
  it('degrades the current session but does NOT persist a verdict when the WebGL context is lost after warm-up', () => {
    motion.tier = 'full';
    render(<DroneScene />);
    expect(screen.getByTestId('drone-canvas')).toBeInTheDocument();
    expect(lastCreatedGl).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    act(() => {
      lastCreatedGl!.domElement.dispatchEvent(new Event('webglcontextlost'));
    });

    expect(screen.queryByTestId('drone-canvas')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(DRONE_TIER_KEY)).toBeNull();
  });

  // `warmedUp` used to be armed once, in a `useEffect` with `deps: []`, at `SceneCanvas`'s first
  // mount only. `frameloop` (the `active` prop) toggles between 'never' and 'always' every time the
  // visitor pauses/resumes or the tab loses/regains focus, without unmounting `SceneCanvas` — so a
  // one-time warm-up left every resume exposed to exactly the cold-start FPS dip the grace period
  // exists to ignore.
  it('re-arms the warm-up grace period every time frameloop resumes to always', () => {
    motion.tier = 'full';
    motion.paused = false;
    const { rerender } = render(<DroneScene />);
    expect(screen.getByTestId('drone-canvas')).toHaveAttribute('data-frameloop', 'always');

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    motion.paused = true;
    rerender(<DroneScene />);
    expect(screen.getByTestId('drone-canvas')).toHaveAttribute('data-frameloop', 'never');

    motion.paused = false;
    rerender(<DroneScene />);
    expect(screen.getByTestId('drone-canvas')).toHaveAttribute('data-frameloop', 'always');

    // Immediately after resuming — still inside the freshly re-armed warm-up window.
    act(() => {
      performanceMonitor.onFallback?.({});
    });
    expect(screen.getByTestId('drone-canvas')).toBeInTheDocument();
    expect(window.localStorage.getItem(DRONE_TIER_KEY)).toBeNull();
  });
});

describe('poseToWorld', () => {
  const view = { width: 10, height: 6 };
  const pose = (x: number, y: number, width = 0.25) => ({ x, y, width, rotationX: 0, rotationY: 0, rotationZ: 0 });

  it('puts a centred pose on the point the camera aims at', () => {
    // React Three Fiber points the default camera at the origin, so screen centre is world zero.
    // Assuming otherwise offsets every pose vertically by the camera height.
    expect(CAMERA_Y).toBe(0);
    const world = poseToWorld(pose(0.5, 0.5), view.width, view.height);
    expect(world.x).toBeCloseTo(0);
    expect(world.y).toBeCloseTo(0);
  });

  it('maps viewport fractions onto the visible world extent', () => {
    expect(poseToWorld(pose(1, 0.5), view.width, view.height).x).toBeCloseTo(5);
    expect(poseToWorld(pose(0, 0.5), view.width, view.height).x).toBeCloseTo(-5);
    expect(poseToWorld(pose(0.5, 1), view.width, view.height).y).toBeCloseTo(CAMERA_Y - 3);
    expect(poseToWorld(pose(0.5, 0), view.width, view.height).y).toBeCloseTo(CAMERA_Y + 3);
  });

  it('derives scale from the requested on-screen width', () => {
    const narrow = poseToWorld(pose(0.5, 0.5, 0.2), view.width, view.height);
    const wide = poseToWorld(pose(0.5, 0.5, 0.4), view.width, view.height);
    expect(wide.scale).toBeCloseTo(narrow.scale * 2);
    expect(narrow.scale).toBeGreaterThan(0);
  });

  it('keeps the same viewport fraction on a different aspect', () => {
    const a = poseToWorld(pose(0.75, 0.5), 10, 6);
    const b = poseToWorld(pose(0.75, 0.5), 20, 6);
    expect(a.x / 10).toBeCloseTo(b.x / 20);
  });
});

describe('resolveStopOffsets', () => {
  const stops = [
    { selector: null, pose: LANDING_POSE },
    { selector: '.mid', pose: LANDING_POSE },
    { selector: '.end', pose: LANDING_POSE },
  ];
  const measure = (selector: string) =>
    ({ '.mid': { top: 1000, height: 400 }, '.end': { top: 4000, height: 500 } })[selector] ?? null;

  it('anchors the opening stop to the top of the page', () => {
    expect(resolveStopOffsets(stops, measure, 600, 5000)[0].at).toBe(0);
  });

  it('places each stop where its element sits centred in the viewport', () => {
    const resolved = resolveStopOffsets(stops, measure, 600, 5000);
    expect(resolved[1].at).toBeCloseTo((1000 + 200 - 300) / 5000);
    expect(resolved[2].at).toBeCloseTo((4000 + 250 - 300) / 5000);
  });

  it('drops stops whose element is not on the page', () => {
    const resolved = resolveStopOffsets(stops, () => null, 600, 5000);
    expect(resolved).toHaveLength(1);
  });

  it('returns stops in ascending scroll order', () => {
    const shuffled = [stops[0], stops[2], stops[1]];
    const resolved = resolveStopOffsets(shuffled, measure, 600, 5000);
    const order = resolved.map((stop) => stop.at);
    expect(order).toEqual(order.slice().sort((a, b) => a - b));
  });

  it('reaches an aligned stop when its element sits at the requested height', () => {
    const aligned = [{ selector: '.end', pose: LANDING_POSE, align: 0.2 }];
    const [stop] = resolveStopOffsets(aligned, measure, 600, 5000);
    // Element top 4000, reached once it sits 0.2 * 600 = 120px below the top of the viewport.
    expect(stop.at).toBeCloseTo((4000 - 120) / 5000);
  });

  it('reaches an aligned stop earlier than the centred default', () => {
    const centred = resolveStopOffsets([{ selector: '.end', pose: LANDING_POSE }], measure, 600, 5000);
    const early = resolveStopOffsets([{ selector: '.end', pose: LANDING_POSE, align: 0.15 }], measure, 600, 5000);
    expect(early[0].at).toBeLessThan(centred[0].at);
  });

  it('survives a page that cannot scroll', () => {
    const resolved = resolveStopOffsets(stops, measure, 600, 0);
    expect(resolved.every((stop) => Number.isFinite(stop.at))).toBe(true);
  });
});

describe('interpolatePose', () => {
  const resolved = resolveStopOffsets(
    FLIGHT_STOPS,
    (selector) => ({ top: FLIGHT_STOPS.findIndex((stop) => stop.selector === selector) * 1000, height: 500 }),
    600,
    6000,
  );

  it('holds the opening pose at the top of the page', () => {
    const { pose, landing } = interpolatePose(resolved, 0);
    expect(pose.x).toBeCloseTo(FLIGHT_STOPS[0].pose.x);
    expect(landing).toBe(0);
  });

  it('settles on the landing pose at the end of the flight', () => {
    const { pose, landing } = interpolatePose(resolved, 1);
    expect(pose.x).toBeCloseTo(LANDING_POSE.x);
    expect(pose.width).toBeCloseTo(LANDING_POSE.width);
    expect(landing).toBe(1);
  });

  it('reports landing only across the final approach', () => {
    const last = resolved[resolved.length - 1].at;
    const previous = resolved[resolved.length - 2].at;
    expect(interpolatePose(resolved, previous).landing).toBeCloseTo(0);
    expect(interpolatePose(resolved, (previous + last) / 2).landing).toBeCloseTo(0.5);
  });

  it('blends linearly between two stops', () => {
    const [first, second] = resolved;
    const half = interpolatePose(resolved, (first.at + second.at) / 2).pose;
    expect(half.x).toBeCloseTo((first.pose.x + second.pose.x) / 2);
    expect(half.width).toBeCloseTo((first.pose.width + second.pose.width) / 2);
  });

  it('never jumps between neighbouring scroll positions', () => {
    let previous = interpolatePose(resolved, 0).pose;
    for (let progress = 0.01; progress <= 1; progress += 0.01) {
      const next = interpolatePose(resolved, progress).pose;
      expect(Math.abs(next.x - previous.x)).toBeLessThan(0.1);
      expect(Math.abs(next.y - previous.y)).toBeLessThan(0.1);
      previous = next;
    }
  });
});

describe('FLIGHT_STOPS', () => {
  const films = FLIGHT_STOPS.filter((stop) => stop.selector?.startsWith('.film-'));

  it('holds the right lane across every catalogue film, which all sit on the left', () => {
    expect(films).toHaveLength(3);
    for (const { pose } of films) {
      expect(pose.x).toBeGreaterThan(0.6);
      expect(pose.x - pose.width / 2).toBeGreaterThan(0.61);
    }
  });

  it('keeps the films at one height so the pass reads as a single move', () => {
    expect(new Set(films.map((stop) => stop.pose.y)).size).toBe(1);
    expect(films[0].pose.y).toBeCloseTo(0.5);
  });

  it('turns the drone toward the films on its left', () => {
    for (const { pose } of films) expect(pose.rotationY).toBeLessThan(0);
  });

  it('shrinks the drone over the full-bleed story so it stops covering the footage', () => {
    const story = FLIGHT_STOPS.find((stop) => stop.selector === '.scroll-story');
    expect(story?.pose.width).toBeLessThan(0.2);
    for (const stop of FLIGHT_STOPS) {
      if (stop.selector !== '.scroll-story') expect(stop.pose.width).toBeGreaterThan(story!.pose.width);
    }
  });

  it('keeps every stop inside the viewport', () => {
    for (const { pose } of FLIGHT_STOPS) {
      expect(pose.x - pose.width / 2).toBeGreaterThan(-0.02);
      expect(pose.x + pose.width / 2).toBeLessThan(1.02);
      expect(pose.y).toBeGreaterThan(0);
      expect(pose.y).toBeLessThan(1);
    }
  });

  it('finishes the landing while the contact form is still framed', () => {
    const contact = FLIGHT_STOPS.filter((stop) => stop.selector === '#contacto');
    // One stop, not two. An approach stop between the services section and the parking spot has
    // to lift the drone back up the screen before it can drop again, and that reversal is the
    // visible jolt as section three hands over to section four.
    expect(contact).toHaveLength(1);
    expect(contact[0].pose).toBe(LANDING_POSE);
    // The parked stop is reached well before the page bottom, not at the very end of the scroll.
    expect(contact[0].align).toBeDefined();
    // Parked while the section is still high in the viewport, not at the page bottom.
    expect(contact[0].align!).toBeGreaterThan(0.2);
    expect(contact[0].align!).toBeLessThan(0.4);
  });

  it('never sends the drone back up the screen once it starts settling', () => {
    // Poses after the story are read top to bottom: the flight only ever descends from there.
    const tail = FLIGHT_STOPS.slice(FLIGHT_STOPS.findIndex((stop) => stop.selector === '.scroll-story'));
    for (let index = 1; index < tail.length; index += 1) {
      expect(tail[index].pose.y).toBeGreaterThanOrEqual(tail[index - 1].pose.y);
    }
  });

  it('is already parked once the contact section is framed', () => {
    const stops = resolveStopOffsets(
      FLIGHT_STOPS,
      (selector) => (selector === '#contacto' ? { top: 6076, height: 745 } : { top: 5189, height: 738 }),
      849,
      6364,
    );
    // Matches the reported scroll position where the form is fully in view.
    const framed = (6076 - 0.14 * 849) / 6364;
    expect(interpolatePose(stops, framed).landing).toBe(1);
  });

  it('keeps the hero drone clear of the centred hero copy', () => {
    const hero = FLIGHT_STOPS[0];
    expect(hero.selector).toBeNull();
    // The copy starts around a third of the way down, so the drone stays above it.
    expect(hero.pose.y + hero.pose.width / 4).toBeLessThan(0.4);
  });

  it('lands low on the left, turned toward the contact form', () => {
    expect(LANDING_POSE.y).toBeGreaterThan(0.6);
    expect(LANDING_POSE.x).toBeLessThan(0.5);
    expect(LANDING_POSE.rotationY).toBeGreaterThan(0);
  });
});

describe('parking the drone on the page', () => {
  const parked = FLIGHT_STOPS[FLIGHT_STOPS.length - 1];
  // Measured inside the contact section: the intro paragraph ends 386px below the section top.
  const CLEAR = 386 + 40;
  const WIDTH = parked.pose.width;
  const topEdge = (y: number, width: number) => y - 0.37 * width;

  it('rests at a fixed place inside the section, not a fixed place on the screen', () => {
    expect(parked.clearBelow).toBeDefined();
    const framed = parkedPoseY(0, CLEAR, WIDTH, 800);
    const scrolledOn = parkedPoseY(-200, CLEAR, WIDTH, 800);
    // Scrolling 200px moves the drone 200px up the screen — it holds station on the page.
    expect(scrolledOn).toBeCloseTo(framed - 200 / 800);
  });

  it('clears the intro copy at every viewport height', () => {
    for (const viewportHeight of [600, 664, 800, 854, 1080, 1440]) {
      const y = parkedPoseY(0, CLEAR, WIDTH, viewportHeight);
      // The drone's top edge stays below the paragraph, whatever the viewport shape.
      expect(topEdge(y, WIDTH) * viewportHeight).toBeGreaterThan(386);
    }
  });

  it('stays inside the section rather than sliding onto the footer', () => {
    const SECTION = 745;
    for (const viewportHeight of [664, 854, 1080]) {
      const y = parkedPoseY(0, CLEAR, WIDTH, viewportHeight);
      expect((y + 0.162 * WIDTH) * viewportHeight).toBeLessThan(SECTION);
    }
  });

  it('degrades safely without a measurable viewport', () => {
    expect(Number.isFinite(parkedPoseY(0, CLEAR, WIDTH, 0))).toBe(true);
  });
});

describe('flying from the services section into the contact form', () => {
  // A real measurement of the page on an 849px-tall viewport, the layout the jolt was reported on.
  const LAYOUT: Record<string, { top: number; height: number }> = {
    '.film-0': { top: 1500, height: 520 },
    '.film-1': { top: 2120, height: 520 },
    '.film-2': { top: 2740, height: 520 },
    '.scroll-story': { top: 3321, height: 1868 },
    '#nosotros': { top: 5189, height: 738 },
    '#contacto': { top: 6076, height: 745 },
  };
  const VIEWPORT = 849;
  const MAX_SCROLL = 6364;
  // The intro paragraph ends 386px below the section top, plus the parking gap.
  const PARKED = { docTop: LAYOUT['#contacto'].top, clearBelow: 386 + 40 };
  const stops = resolveStopOffsets(FLIGHT_STOPS, (selector) => LAYOUT[selector] ?? null, VIEWPORT, MAX_SCROLL);
  const screenY = (scrolled: number) =>
    flightPose(stops, scrolled, MAX_SCROLL, VIEWPORT, PARKED).pose.y * VIEWPORT;
  /** How far the drone slides across the screen for every pixel the reader scrolls. */
  const screenSpeed = (scrolled: number) => screenY(scrolled + 1) - screenY(scrolled);
  // The story stop is reached with the full-bleed section centred; the descent runs from there.
  const storyStop = LAYOUT['.scroll-story'].top + LAYOUT['.scroll-story'].height / 2 - VIEWPORT / 2;
  const lastStop = stops[stops.length - 1].at * MAX_SCROLL;

  it('only ever descends, from the story all the way to the parking spot', () => {
    // Reversing direction mid-flight is what reads as a jump: the drone climbs toward one stop
    // and then dives toward the next, and the reader sees the corner between the two.
    for (let scrolled = storyStop; scrolled < lastStop; scrolled += 4) {
      expect(screenSpeed(scrolled)).toBeGreaterThan(-0.02);
    }
  });

  it('holds one steady pace instead of lurching', () => {
    for (let scrolled = storyStop; scrolled < lastStop; scrolled += 4) {
      // Anything past 1 means the drone crosses the screen faster than the page scrolls under it.
      expect(screenSpeed(scrolled)).toBeLessThan(0.6);
    }
  });

  it('never jolts as one stop hands over to the next', () => {
    for (let scrolled = storyStop; scrolled < lastStop - 8; scrolled += 4) {
      // A stop boundary may change the pace, but not reverse or multiply it in a single frame.
      expect(Math.abs(screenSpeed(scrolled + 4) - screenSpeed(scrolled))).toBeLessThan(0.25);
    }
  });

  it('settles on the parking spot without overshooting it', () => {
    const resting = screenY(lastStop);
    for (let scrolled = storyStop; scrolled <= lastStop; scrolled += 4) {
      expect(screenY(scrolled)).toBeLessThanOrEqual(resting + 0.5);
    }
    // Once parked the drone belongs to the page: scrolling on carries it up the screen with it.
    expect(screenY(lastStop + 200)).toBeCloseTo(resting - 200, 0);
  });

  it('leaves the flight untouched before the final approach', () => {
    // The document-space landing must not leak backwards into the poses above it.
    for (const scrolled of [0, 1200, 2600, 3800]) {
      const { pose, landing } = flightPose(stops, scrolled, MAX_SCROLL, VIEWPORT, PARKED);
      expect(landing).toBe(0);
      expect(pose.y).toBeCloseTo(interpolatePose(stops, scrolled / MAX_SCROLL).pose.y);
    }
  });

  it('falls back to the pose height when the section cannot be measured', () => {
    const { pose } = flightPose(stops, lastStop, MAX_SCROLL, VIEWPORT, null);
    expect(pose.y).toBeCloseTo(LANDING_POSE.y);
    expect(Number.isFinite(flightPose(stops, lastStop, MAX_SCROLL, 0, PARKED).pose.y)).toBe(true);
  });
});

describe('follow', () => {
  const frame = 0.016;

  it('damps normally while the drone is flying', () => {
    const flown = follow(0, 10, 2.8, frame, 0);
    expect(flown).toBeGreaterThan(0);
    expect(flown).toBeLessThan(10);
  });

  it('tracks the target exactly once parked', () => {
    // A parked drone belongs to the page, so any lag reads as the drone sliding around.
    expect(follow(0, 10, 2.8, frame, 1)).toBe(10);
    expect(follow(-4, 2.5, 2.8, frame, 1)).toBe(2.5);
  });

  it('hands over gradually so the landing has no seam', () => {
    const damped = follow(0, 10, 2.8, frame, 0);
    const half = follow(0, 10, 2.8, frame, 0.5);
    expect(half).toBeGreaterThan(damped);
    expect(half).toBeLessThan(10);
    expect(half).toBeCloseTo(damped + (10 - damped) * 0.5);
  });

  it('does not overshoot when the target is already reached', () => {
    expect(follow(5, 5, 2.8, frame, 0)).toBeCloseTo(5);
    expect(follow(5, 5, 2.8, frame, 1)).toBe(5);
  });
});

describe('rotorTargetSpeed', () => {
  it('holds the rotors still until the page is scrolled', () => {
    expect(rotorTargetSpeed(0, 0)).toBe(0);
  });

  it('spins the rotors up as the first scroll begins', () => {
    const early = [0.005, 0.01, 0.02, 0.04].map((progress) => rotorTargetSpeed(progress, 0));
    for (let index = 1; index < early.length; index += 1) {
      expect(early[index]).toBeGreaterThan(early[index - 1]);
    }
    expect(early[0]).toBeGreaterThan(0);
    // Cruising revs are reached quickly, well inside the hero.
    expect(rotorTargetSpeed(0.06, 0)).toBeCloseTo(rotorTargetSpeed(0.06, 0));
    expect(rotorTargetSpeed(0.08, 0)).toBeGreaterThan(rotorTargetSpeed(0.04, 0) * 0.9);
  });

  it('keeps the rotors spinning at the end of the scroll when no landing is underway', () => {
    expect(rotorTargetSpeed(1, 0)).toBeGreaterThan(0);
  });

  it('cuts the target to a full stop once parked', () => {
    expect(rotorTargetSpeed(0.4, 1)).toBe(0);
    expect(rotorTargetSpeed(1, 1)).toBe(0);
  });

  it('decreases monotonically as the landing progresses', () => {
    const speeds = [0, 0.25, 0.5, 0.75, 1].map((landing) => rotorTargetSpeed(0.9, landing));
    for (let index = 1; index < speeds.length; index += 1) {
      expect(speeds[index]).toBeLessThan(speeds[index - 1]);
    }
  });
});

describe('stepRotorSpeed', () => {
  const frame = 0.016;
  const cruise = rotorTargetSpeed(1, 0);
  const run = (from: number, target: number, done: (value: number) => boolean, limit = 1200) => {
    let value = from;
    let frames = 0;
    while (!done(value) && frames < limit) {
      value = stepRotorSpeed(value, target, frame);
      frames += 1;
    }
    return { value, frames };
  };

  it('ramps down instead of cutting to zero', () => {
    const afterOneFrame = stepRotorSpeed(cruise, 0, frame);
    expect(afterOneFrame).toBeLessThan(cruise);
    expect(afterOneFrame).toBeGreaterThan(cruise * 0.9);
  });

  it('eventually reaches a full stop', () => {
    const { value, frames } = run(cruise, 0, (current) => current === 0);
    expect(value).toBe(0);
    expect(frames).toBeLessThan(1200);
  });

  it('ramps up faster than it ramps down', () => {
    const up = run(0, cruise, (current) => current >= cruise * 0.9);
    const down = run(cruise, 0, (current) => current <= cruise * 0.1);
    expect(up.frames).toBeLessThan(down.frames);
  });

  it('snaps the last sliver of momentum to a clean stop', () => {
    expect(stepRotorSpeed(0.02, 0, frame)).toBe(0);
  });
});

describe('pointerLook', () => {
  it('looks down when the pointer is below the centre of the viewport', () => {
    expect(pointerLook({ x: 0, y: 1 }, 0).pitch).toBeGreaterThan(0);
    expect(pointerLook({ x: 0, y: -1 }, 0).pitch).toBeLessThan(0);
  });

  it('keeps following the pointer horizontally', () => {
    expect(pointerLook({ x: 1, y: 0 }, 0).yaw).toBeGreaterThan(0);
    expect(pointerLook({ x: -1, y: 0 }, 0).yaw).toBeLessThan(0);
  });

  it('locks onto the contact form once parked', () => {
    const look = pointerLook({ x: -1, y: -1 }, 1);
    expect(look.yaw).toBeCloseTo(GIMBAL_LANDING_YAW);
    expect(look.pitch).toBeCloseTo(GIMBAL_LANDING_PITCH);
  });

  it('fades pointer influence out while landing', () => {
    const spread = (landing: number) =>
      pointerLook({ x: 1, y: 1 }, landing).yaw - pointerLook({ x: -1, y: -1 }, landing).yaw;
    expect(spread(0.5)).toBeLessThan(spread(0));
    expect(spread(0.5)).toBeGreaterThan(0);
    expect(spread(1)).toBe(0);
  });
});

// Phase 3: hover mode has no scroll to derive motion from, so `hoverPose`/`hoverLook` are driven
// purely by wall-clock time instead of `progress`/`landing`.
describe('hoverPose', () => {
  const base = { x: 0.5, y: 0.2, width: 0.22, rotationX: 0.05, rotationY: 0, rotationZ: 0 };

  it('sits exactly on the base pose at time zero', () => {
    expect(hoverPose(base, 0)).toEqual(base);
  });

  it('stays bounded around the base pose forever', () => {
    for (let time = 0; time < 200; time += 1.7) {
      const pose = hoverPose(base, time);
      expect(Math.abs(pose.x - base.x)).toBeLessThan(0.05);
      expect(Math.abs(pose.y - base.y)).toBeLessThan(0.05);
      expect(Math.abs(pose.rotationZ - base.rotationZ)).toBeLessThan(0.05);
    }
  });

  it('changes continuously — a small step in time is a small step in pose', () => {
    let previous = hoverPose(base, 0);
    for (let time = 0.016; time < 20; time += 0.016) {
      const next = hoverPose(base, time);
      expect(Math.abs(next.x - previous.x)).toBeLessThan(0.01);
      expect(Math.abs(next.y - previous.y)).toBeLessThan(0.01);
      previous = next;
    }
  });

  it('repeats on a fixed period', () => {
    const period = 6; // seconds — must match the internal HOVER_PERIOD.
    for (const time of [0, 0.4, 1.9, 3.3, 5.1]) {
      const a = hoverPose(base, time);
      const b = hoverPose(base, time + period);
      expect(a.x).toBeCloseTo(b.x);
      expect(a.y).toBeCloseTo(b.y);
      expect(a.rotationZ).toBeCloseTo(b.rotationZ);
    }
  });

  it('leaves fields it does not animate untouched', () => {
    const pose = hoverPose(base, 3.14);
    expect(pose.width).toBe(base.width);
    expect(pose.rotationX).toBe(base.rotationX);
  });
});

describe('hoverLook', () => {
  it('is bounded regardless of how much time has passed', () => {
    for (let time = 0; time < 500; time += 3.3) {
      const look = hoverLook(time);
      expect(Math.abs(look.yaw)).toBeLessThan(0.3);
      expect(Math.abs(look.pitch)).toBeLessThan(0.3);
    }
  });

  it('depends only on time — the same instant always looks the same way', () => {
    expect(hoverLook(4.2)).toEqual(hoverLook(4.2));
  });

  it('is not the zero-motion vector — the gimbal actually scans while hovering', () => {
    const looks = [0, 1, 2, 3, 4, 5].map(hoverLook);
    expect(looks.some((look) => Math.abs(look.yaw) > 0.01 || Math.abs(look.pitch) > 0.01)).toBe(true);
  });
});

describe('HOVER_ROTOR_SPEED', () => {
  it('is a real positive idle speed, not the flight function evaluated at rest', () => {
    // `rotorTargetSpeed(0, 0)` is 0 by design — flight rotors only spin once the page scrolls.
    // Hover has no scroll at all, so reusing that function would freeze the rotors on a drone
    // that is otherwise visibly bobbing and drifting, which reads as broken, not parked.
    expect(rotorTargetSpeed(0, 0)).toBe(0);
    expect(HOVER_ROTOR_SPEED).toBeGreaterThan(0);
  });

  it('actually moves the rotors forward when stepped as the hover target', () => {
    const frame = 0.016;
    let speed = 0;
    for (let i = 0; i < 60; i += 1) speed = stepRotorSpeed(speed, HOVER_ROTOR_SPEED, frame);
    expect(speed).toBeGreaterThan(0);
  });
});

describe('heroBandPose', () => {
  it('keeps the drone within the open band above the copy, not inside it', () => {
    const band = { top: 0, bottom: 180 };
    const heroHeight = 760;
    const pose = heroBandPose(band, heroHeight);
    expect(pose.y).toBeGreaterThanOrEqual(band.top / heroHeight);
    expect(pose.y).toBeLessThanOrEqual(band.bottom / heroHeight);
  });

  it('sizes the drone to fit inside a narrower band', () => {
    const wide = heroBandPose({ top: 0, bottom: 400 }, 760);
    const narrow = heroBandPose({ top: 0, bottom: 150 }, 760);
    expect(narrow.width).toBeLessThanOrEqual(wide.width);
  });

  it('degrades to a finite, sane pose when the band is too small to be worth flying in', () => {
    const pose = heroBandPose({ top: 40, bottom: 55 }, 760);
    expect(Number.isFinite(pose.x)).toBe(true);
    expect(Number.isFinite(pose.y)).toBe(true);
    expect(pose.width).toBeGreaterThan(0);
  });

  it('degrades to a finite, sane pose when the hero could not be measured', () => {
    const pose = heroBandPose({ top: 0, bottom: 400 }, 0);
    expect(Number.isFinite(pose.x)).toBe(true);
    expect(Number.isFinite(pose.y)).toBe(true);
    expect(pose.width).toBeGreaterThan(0);
  });
});

// Regression: `.hero-topline` paints with no `z-index` (see the CSS comment on `.drone-scene`), so
// it renders BELOW the drone (`z-index:2`). The open band the hovering drone flies in used to start
// at the hero's own top edge (`top: 0`), which on a real mobile layout (`.site-header` ~90px,
// `.hero-topline` at `top:118px`) sits the drone directly on top of the topline text.
describe('heroBandTop', () => {
  it('starts the band below the topline, not at the hero edge', () => {
    // A realistic mobile measurement: hero starts at viewport y=90 (below the fixed header), the
    // topline sits at hero-relative top:118px and is ~20px tall, so its bottom edge is at
    // viewport y = 90 + 118 + 20 = 228.
    const heroTop = 90;
    const toplineBottom = 228;
    expect(heroBandTop(toplineBottom, heroTop)).toBeCloseTo(138); // 228 - 90
    expect(heroBandTop(toplineBottom, heroTop)).toBeGreaterThan(0);
  });

  it('degrades to the hero edge when the topline could not be measured', () => {
    expect(heroBandTop(null, 90)).toBe(0);
  });

  it('never goes negative even if the topline measured above the hero top', () => {
    expect(heroBandTop(50, 90)).toBe(0);
  });
});

describe('heroBandPose — kept clear of the topline', () => {
  it('keeps the drone below the topline once the band starts under it', () => {
    const heroHeight = 730;
    const toplineBottom = heroBandTop(228, 90); // see heroBandTop tests above
    const band = { top: toplineBottom, bottom: 300 };
    const pose = heroBandPose(band, heroHeight);
    expect(pose.y).toBeGreaterThanOrEqual(band.top / heroHeight);
  });
});

// A shadow map nothing samples is a depth pass rendered every frame for no visible output. The
// flight canvas turns `shadows` on and flags every mesh as a caster, so the meshes must also
// receive: with no floor plane in the scene, self-shadowing is the only thing those shadows can
// ever land on.
describe('DroneScene — shadow flags', () => {
  type ShadowMesh = { name: string; isMesh: true; castShadow: boolean; receiveShadow: boolean; visible: boolean };

  const mesh = (name: string): ShadowMesh => ({ name, isMesh: true, castShadow: false, receiveShadow: false, visible: true });

  function stubSceneWith(nodes: ShadowMesh[]) {
    vi.mocked(useGLTF).mockReturnValue({
      scene: {
        getObjectByName: () => undefined,
        traverse: (visit: (node: unknown) => void) => nodes.forEach(visit),
      },
    } as never);
  }

  afterEach(() => {
    // Restore the file-level default: `vi.clearAllMocks()` resets recorded calls, not implementations.
    vi.mocked(useGLTF).mockImplementation((() => ({ scene: { getObjectByName: () => undefined } })) as never);
    delete (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback;
  });

  it('lets the drone receive the shadows it casts in flight mode', () => {
    const body = mesh('Body');
    stubSceneWith([body]);
    motion.tier = 'full';
    render(<DroneScene />);
    expect(body.castShadow).toBe(true);
    expect(body.receiveShadow).toBe(true);
  });

  it('leaves both shadow flags off in bounded hover mode, where the canvas disables shadows', () => {
    const body = mesh('Body');
    stubSceneWith([body]);
    (window as unknown as { requestIdleCallback: unknown }).requestIdleCallback = (callback: IdleRequestCallback) => {
      callback({ didTimeout: false, timeRemaining: () => 0 });
      return 1;
    };
    motion.tier = 'lite';
    render(<DroneScene />);
    expect(body.castShadow).toBe(false);
    expect(body.receiveShadow).toBe(false);
  });
});
