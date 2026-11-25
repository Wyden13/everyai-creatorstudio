//! Native Rust media acceleration helpers for EveryAI CreatorStudio desktop.
//! Pure functions (peak extraction, key sanitization) are unit-tested directly;
//! FFmpeg and filesystem I/O live at the explicit command boundaries.

use std::path::{Path, PathBuf};
use std::process::Command;

/// Pure peak extractor: downsamples mono signed-16-bit PCM into `buckets` normalized
/// amplitudes in `0.0..=1.0` for the Voiceover History waveform player.
pub fn extract_pcm_peaks(samples: &[i16], buckets: usize) -> Vec<f32> {
    if samples.is_empty() || buckets == 0 {
        return Vec::new();
    }
    let chunk = (samples.len() as f64 / buckets as f64).max(1.0);
    let mut peaks = Vec::with_capacity(buckets);
    for i in 0..buckets {
        let start = (i as f64 * chunk).floor() as usize;
        let end = (((i + 1) as f64 * chunk).ceil() as usize).min(samples.len());
        if start >= end {
            peaks.push(0.0);
            continue;
        }
        let max_abs = samples[start..end]
            .iter()
            .map(|&s| (s as i32).unsigned_abs())
            .max()
            .unwrap_or(0);
        peaks.push((max_abs as f32 / 32768.0).clamp(0.0, 1.0));
    }
    peaks
}

/// Strips path separators and traversal segments so cache keys never escape `cache_dir`.
pub fn sanitize_cache_key(key: &str) -> String {
    key.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>()
        .replace("..", "_")
}

pub fn cache_media_path(cache_dir: &Path, key: &str) -> PathBuf {
    cache_dir.join(sanitize_cache_key(key))
}

pub fn extract_waveform_from_file(file_path: &str, buckets: usize) -> Result<Vec<f32>, String> {
    let out = Command::new("ffmpeg")
        .args(["-v", "error", "-i", file_path, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"])
        .output()
        .map_err(|e| format!("failed to spawn ffmpeg: {e}"))?;

    if !out.status.success() {
        return Err(format!(
            "ffmpeg waveform decode failed: {}",
            String::from_utf8_lossy(&out.stderr)
        ));
    }

    let samples: Vec<i16> = out
        .stdout
        .chunks_exact(2)
        .map(|pair| i16::from_le_bytes([pair[0], pair[1]]))
        .collect();
    Ok(extract_pcm_peaks(&samples, buckets))
}

pub fn grab_frame_to_png(video_path: &str, timestamp_sec: f64, out_png_path: &str) -> Result<String, String> {
    let ts = format!("{:.3}", timestamp_sec.max(0.0));
    let out = Command::new("ffmpeg")
        .args(["-y", "-v", "error", "-ss", &ts, "-i", video_path, "-frames:v", "1", out_png_path])
        .output()
        .map_err(|e| format!("failed to spawn ffmpeg: {e}"))?;

    if !out.status.success() {
        return Err(format!(
            "ffmpeg frame grab failed: {}",
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    Ok(out_png_path.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pcm_peaks_normalizes_and_respects_bucket_count() {
        let samples = vec![0i16, 16384, -32768, 8192];
        let peaks = extract_pcm_peaks(&samples, 2);
        assert_eq!(peaks.len(), 2);
        assert!((peaks[0] - 0.5).abs() < 0.001);
        assert!((peaks[1] - 1.0).abs() < 0.001);
        assert!(extract_pcm_peaks(&[], 8).is_empty());
        assert!(extract_pcm_peaks(&samples, 0).is_empty());
    }

    #[test]
    fn sanitize_cache_key_blocks_traversal() {
        let safe = sanitize_cache_key("../../etc/passwd");
        assert!(!safe.contains(".."));
        assert!(!safe.contains('/'));
        assert_eq!(sanitize_cache_key("vid_0418-16x9.mp4"), "vid_0418-16x9.mp4");
    }
}
