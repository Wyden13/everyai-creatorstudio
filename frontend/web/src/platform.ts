/**
 * Explicit platform boundary between Browser Web and Tauri v2 Desktop.
 * UI components call this module instead of checking window.__TAURI__ directly.
 */

export type RuntimePlatform = 'web' | 'tauri';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
    };
  }
}

export function getRuntimePlatform(): RuntimePlatform {
  return typeof window !== 'undefined' && typeof window.__TAURI_INTERNALS__ !== 'undefined'
    ? 'tauri'
    : 'web';
}

export async function invokeNative<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const tauri = window.__TAURI_INTERNALS__;
  if (!tauri) {
    throw new Error(`Native command "${cmd}" unavailable in browser web runtime`);
  }
  return tauri.invoke<T>(cmd, args);
}
