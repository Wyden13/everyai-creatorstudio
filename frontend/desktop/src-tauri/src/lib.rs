mod media;

use serde::Serialize;
use std::fs;
use std::path::PathBuf;

#[derive(Serialize)]
struct DesktopHealth {
    platform: &'static str,
    version: &'static str,
    ffmpeg_available: bool,
}

#[tauri::command]
fn desktop_health() -> DesktopHealth {
    let ffmpeg_available = std::process::Command::new("ffmpeg")
        .arg("-version")
        .output()
        .is_ok();

    DesktopHealth {
        platform: std::env::consts::OS,
        version: env!("CARGO_PKG_VERSION"),
        ffmpeg_available,
    }
}

#[tauri::command]
fn extract_audio_waveform(file_path: String, buckets: usize) -> Result<Vec<f32>, String> {
    media::extract_waveform_from_file(&file_path, buckets.clamp(8, 256))
}

#[tauri::command]
fn cache_media_bytes(key: String, bytes: Vec<u8>) -> Result<String, String> {
    let dir: PathBuf = std::env::temp_dir().join("everyai-creatorstudio-cache");
    fs::create_dir_all(&dir).map_err(|e| format!("cache dir error: {e}"))?;
    let target = media::cache_media_path(&dir, &key);
    fs::write(&target, bytes).map_err(|e| format!("cache write error: {e}"))?;
    Ok(target.to_string_lossy().into_owned())
}

#[tauri::command]
fn grab_video_frame(video_path: String, timestamp_sec: f64, out_png_path: String) -> Result<String, String> {
    media::grab_frame_to_png(&video_path, timestamp_sec, &out_png_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            desktop_health,
            extract_audio_waveform,
            cache_media_bytes,
            grab_video_frame
        ])
        .run(tauri::generate_context!())
        .expect("error while running EveryAI CreatorStudio desktop");
}
