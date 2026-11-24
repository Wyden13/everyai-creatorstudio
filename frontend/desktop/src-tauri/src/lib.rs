use serde::Serialize;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![desktop_health])
        .run(tauri::generate_context!())
        .expect("error while running EveryAI CreatorStudio desktop");
}
