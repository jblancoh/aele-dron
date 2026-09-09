'use client';
import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';

type Connection = {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (event: string, callback: () => void) => void;
  removeEventListener?: (event: string, callback: () => void) => void;
};
function connection() { return (navigator as Navigator & { connection?: Connection }).connection; }

/**
 * `effectiveType` values slow enough that autoplaying the hero's 2.4MB `coast.mp4` would compete
 * with the rest of the page for bandwidth. Device/GPU capability is a different signal entirely
 * (see `aele:drone-tier` in drone-scene.tsx, which measures rendering, not network) — video decode
 * is hardware-accelerated on any phone, so the video's own gate is network quality alone.
 */
const SLOW_NETWORK_TYPES = new Set(['slow-2g', '2g', '3g']);
function isSlowNetwork() {
  const type = connection()?.effectiveType;
  return !!type && SLOW_NETWORK_TYPES.has(type);
}

/** Single source of truth for the desktop breakpoint — CSS must never redeclare it. */
export const DESKTOP_QUERY = '(min-width: 701px)';
export const STORAGE_KEY = 'aele:motion';

export type MotionPreference = 'unset' | 'on' | 'off';
export type MotionTier = 'full' | 'lite' | 'none';

const PREFERENCE_ON_BIT = 8;
const PREFERENCE_OFF_BIT = 16;
const SLOW_NETWORK_BIT = 32;

// Cached so repeated snapshot() calls don't hit localStorage on every render. Invalidated by
// writePreference() (this tab) and by the 'storage' event (another tab).
let cachedPreference: MotionPreference | null = null;

function readPreference(): MotionPreference {
  if (cachedPreference !== null) return cachedPreference;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cachedPreference = raw === 'on' || raw === 'off' ? raw : 'unset';
  } catch {
    // Safari private browsing (and similar) throws on read.
    cachedPreference = 'unset';
  }
  return cachedPreference;
}

const listeners = new Set<() => void>();
function notify() { listeners.forEach((listener) => listener()); }

function writePreference(value: MotionPreference) {
  try {
    if (value === 'unset') window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Write blocked (e.g. private browsing): the preference just won't persist across reloads.
  }
  cachedPreference = value;
  notify();
}

function preferenceBits(preference: MotionPreference) {
  if (preference === 'on') return PREFERENCE_ON_BIT;
  if (preference === 'off') return PREFERENCE_OFF_BIT;
  return 0;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = window.matchMedia(DESKTOP_QUERY);
  const network = connection();
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    cachedPreference = null;
    notify();
  };
  reduced.addEventListener('change', callback);
  desktop.addEventListener('change', callback);
  network?.addEventListener?.('change', callback);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(callback);
    reduced.removeEventListener('change', callback);
    desktop.removeEventListener('change', callback);
    network?.removeEventListener?.('change', callback);
    window.removeEventListener('storage', onStorage);
  };
}

function snapshot() {
  return (
    (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0) |
    (window.matchMedia(DESKTOP_QUERY).matches ? 2 : 0) |
    (connection()?.saveData ? 4 : 0) |
    preferenceBits(readPreference()) |
    (isSlowNetwork() ? SLOW_NETWORK_BIT : 0)
  );
}

/**
 * React calls this for both the server render and the client's hydration render, so the
 * static HTML and the first client render always agree regardless of what localStorage says.
 * Must keep returning the "no motion" value (reduced, not desktop, unset preference).
 */
export function getServerSnapshot() {
  return 1;
}

export function resolveTier(policy: { reduced: boolean; desktop: boolean; saveData: boolean; preference: MotionPreference }): MotionTier {
  if (policy.preference === 'off') return 'none';
  if (policy.preference === 'on') return policy.desktop ? 'full' : 'lite';
  if (policy.reduced || policy.saveData) return 'none';
  return policy.desktop ? 'full' : 'lite';
}

type MotionContextValue = {
  paused: boolean;
  reduced: boolean;
  desktop: boolean;
  saveData: boolean;
  /**
   * Whether the network is fast enough to autoplay the hero's background video — see
   * `SLOW_NETWORK_TYPES`. Independent of `tier`/`capabilityTier`: those gate the WebGL drone on
   * device/viewport/reduced-motion/Save-Data, none of which is what the video's 2.4MB download
   * actually costs. `true` when `navigator.connection` (and therefore `effectiveType`) does not
   * exist at all — Safari never implements it, and an unknown network must not be treated as slow.
   */
  networkOk: boolean;
  preference: MotionPreference;
  tier: MotionTier;
  capabilityTier: MotionTier;
  toggle: () => void;
  setPreference: (value: MotionPreference) => void;
};

const MotionContext = createContext<MotionContextValue>({
  paused: false,
  reduced: true,
  desktop: false,
  saveData: false,
  networkOk: true,
  preference: 'unset',
  tier: 'none',
  capabilityTier: 'none',
  toggle: () => {},
  setPreference: () => {},
});

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const policy = useSyncExternalStore(subscribe, snapshot, getServerSnapshot);
  const reduced = !!(policy & 1);
  const desktop = !!(policy & 2);
  const saveData = !!(policy & 4);
  const networkOk = !(policy & SLOW_NETWORK_BIT);
  const preference: MotionPreference = policy & PREFERENCE_ON_BIT ? 'on' : policy & PREFERENCE_OFF_BIT ? 'off' : 'unset';
  const tier = resolveTier({ reduced, desktop, saveData, preference });
  // What this session could run if motion were switched on. A paused visitor can be resumed; a
  // visitor on a phone, on Save-Data, or asking for reduced motion cannot. Consumers that freeze
  // rather than unmount need to tell those two apart, so resolve the tier with the pause removed.
  const capabilityTier = resolveTier({ reduced, desktop, saveData, preference: preference === 'off' ? 'unset' : preference });
  const setPreference = useCallback((value: MotionPreference) => writePreference(value), []);
  const toggle = useCallback(() => writePreference(preference === 'off' ? 'on' : 'off'), [preference]);
  return (
    <MotionContext.Provider value={{ paused: preference === 'off', reduced, desktop, saveData, networkOk, preference, tier, capabilityTier, toggle, setPreference }}>
      {children}
    </MotionContext.Provider>
  );
}

export const useMotion = () => useContext(MotionContext);
