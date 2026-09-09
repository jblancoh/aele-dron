import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
Object.defineProperty(window, 'matchMedia', { writable:true, value:vi.fn().mockImplementation(query => ({matches:false,media:query,addEventListener:vi.fn(),removeEventListener:vi.fn(),addListener:vi.fn(),removeListener:vi.fn(),dispatchEvent:vi.fn()})) });
class Observer { observe(){} unobserve(){} disconnect(){} }
vi.stubGlobal('IntersectionObserver',Observer);
vi.stubGlobal('ResizeObserver',Observer);
HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
HTMLMediaElement.prototype.pause = vi.fn();
HTMLMediaElement.prototype.load = vi.fn();
HTMLElement.prototype.scrollIntoView = vi.fn();
