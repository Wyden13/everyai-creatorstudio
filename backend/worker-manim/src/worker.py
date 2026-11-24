"""EveryAI CreatorStudio — Sandboxed Manim CE Worker."""

from __future__ import annotations

import subprocess
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from sandbox import validate_manim_source

WorkerStatus = Literal["Healthy", "Working", "Failing"]
AspectRatio = Literal["16:9", "9:16"]


@dataclass(frozen=True)
class AspectConfig:
    width: int
    height: int
    fps: int


# Native resolution table: 9:16 is rendered natively, never cropped from 16:9.
ASPECT_CONFIG: dict[AspectRatio, AspectConfig] = {
    "16:9": AspectConfig(width=1920, height=1080, fps=60),
    "9:16": AspectConfig(width=1080, height=1920, fps=60),
}


@dataclass(frozen=True)
class HealthCheckEvent:
    event_type: Literal["worker.health_check"]
    worker: Literal["manim"]
    status: WorkerStatus
    timestamp: str
    queue_depth: int
    last_error: str | None = None


@dataclass(frozen=True)
class ManimRenderJob:
    job_id: str
    scene_class: str
    python_source: str
    aspect_ratio: AspectRatio
    transparent: bool = True
    ass_subtitle_path: str | None = None
    timeout_sec: int = 120


@dataclass(frozen=True)
class ManimRenderResult:
    ok: bool
    output_path: str | None = None
    error: str | None = None


def build_health_event(status: WorkerStatus, queue_depth: int = 0, last_error: str | None = None) -> HealthCheckEvent:
    return HealthCheckEvent(
        event_type="worker.health_check",
        worker="manim",
        status=status,
        timestamp=datetime.now(timezone.utc).isoformat(),
        queue_depth=queue_depth,
        last_error=last_error,
    )


def build_manim_command(job: ManimRenderJob, script_path: Path, media_dir: Path) -> list[str]:
    cfg = ASPECT_CONFIG[job.aspect_ratio]
    cmd = [
        "manim",
        "render",
        "-r",
        f"{cfg.width},{cfg.height}",
        "--fps",
        str(cfg.fps),
        "--media_dir",
        str(media_dir),
    ]
    if job.transparent:
        cmd.append("--transparent")
    cmd.extend([str(script_path), job.scene_class])
    return cmd


def build_caption_burn_command(video_path: Path, ass_subtitle_path: str, output_path: Path) -> list[str]:
    escaped = ass_subtitle_path.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
    return [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-vf",
        f"ass='{escaped}'",
        "-c:a",
        "copy",
        str(output_path),
    ]


def execute_manim_job(job: ManimRenderJob) -> ManimRenderResult:
    check = validate_manim_source(job.python_source)
    if not check.ok:
        return ManimRenderResult(ok=False, error=check.reason)

    with tempfile.TemporaryDirectory(prefix=f"manim_{job.job_id}_") as tmp:
        tmp_path = Path(tmp)
        script_path = tmp_path / "scene.py"
        script_path.write_text(job.python_source, encoding="utf-8")
        cmd = build_manim_command(job, script_path, tmp_path / "media")
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=job.timeout_sec, check=False)
        except FileNotFoundError:
            return ManimRenderResult(ok=False, error="manim CLI not installed in worker environment")
        except subprocess.TimeoutExpired:
            return ManimRenderResult(ok=False, error=f"manim render exceeded timeout ({job.timeout_sec}s)")

        if proc.returncode != 0:
            return ManimRenderResult(ok=False, error=proc.stderr[-500:] or f"manim exited {proc.returncode}")

        videos = list((tmp_path / "media").rglob("*.mov")) + list((tmp_path / "media").rglob("*.mp4"))
        if not videos:
            return ManimRenderResult(ok=False, error="manim finished without producing a video file")

        final_video = videos[0]
        if job.ass_subtitle_path:
            captioned = tmp_path / f"captioned_{final_video.name}"
            burn = subprocess.run(
                build_caption_burn_command(final_video, job.ass_subtitle_path, captioned),
                capture_output=True,
                text=True,
                timeout=job.timeout_sec,
                check=False,
            )
            if burn.returncode != 0:
                return ManimRenderResult(ok=False, error=burn.stderr[-500:] or "ffmpeg caption burn failed")
            final_video = captioned

        return ManimRenderResult(ok=True, output_path=str(final_video))


if __name__ == "__main__":
    ev = build_health_event("Healthy")
    print(f"[worker-manim] ready: {ev}")
