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

export interface DesktopHealth {
  platform: string;
  version: string;
  ffmpeg_available: boolean;
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

export async function getDesktopHealth(): Promise<DesktopHealth | null> {
  if (getRuntimePlatform() !== 'tauri') return null;
  return invokeNative<DesktopHealth>('desktop_health');
}

export async function extractNativeWaveform(filePath: string, buckets = 64): Promise<number[]> {
  return invokeNative<number[]>('extract_audio_waveform', { filePath, buckets });
}

export async function grabNativeVideoFrame(
  videoPath: string,
  timestampSec: number,
  outPngPath: string,
): Promise<string> {
  return invokeNative<string>('grab_video_frame', { videoPath, timestampSec, outPngPath });
}
