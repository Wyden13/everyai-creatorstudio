"""Persistent Redis consumer + periodic health heartbeat publisher for worker-manim."""

from __future__ import annotations

import json
import os
import time
import urllib.request
from dataclasses import asdict

from worker import ManimRenderJob, build_health_event, execute_manim_job

MANIM_QUEUE_KEY = "creatorstudio:jobs:manim"


def parse_manim_job(raw: str) -> ManimRenderJob | None:
    try:
        data = json.loads(raw)
        return ManimRenderJob(
            job_id=str(data["job_id"]),
            scene_class=str(data["scene_class"]),
            python_source=str(data["python_source"]),
            aspect_ratio=data.get("aspect_ratio", "16:9"),
            transparent=bool(data.get("transparent", True)),
            ass_subtitle_path=data.get("ass_subtitle_path"),
        )
    except (KeyError, ValueError, TypeError):
        return None


def build_heartbeat_payload(workspace_id: str, status: str = "Healthy", queue_depth: int = 0, last_error: str | None = None) -> dict[str, object]:
    ev = build_health_event(status, queue_depth=queue_depth, last_error=last_error)  # type: ignore[arg-type]
    return {
        "workspace_id": workspace_id,
        "event_type": ev.event_type,
        "node_id": "manim",
        "status": ev.status,
        "line": f"manim {ev.status.lower()} (queue={ev.queue_depth})" if not ev.last_error else ev.last_error,
        "meta": asdict(ev),
    }


def post_heartbeat(core_url: str, worker_token: str, workspace_id: str, status: str = "Healthy", queue_depth: int = 0) -> int:
    payload = json.dumps(build_heartbeat_payload(workspace_id, status=status, queue_depth=queue_depth)).encode("utf-8")
    req = urllib.request.Request(
        f"{core_url.rstrip('/')}/api/internal/events",
        data=payload,
        headers={"Content-Type": "application/json", "X-Worker-Token": worker_token},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return resp.status


def run_daemon() -> None:
    import redis  # type: ignore[import-not-found]

    redis_url = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0")
    core_url = os.environ.get("CORE_URL", "http://127.0.0.1:8080")
    token = os.environ.get("INTERNAL_WORKER_TOKEN", "dev-worker-token")
    ws_id = os.environ.get("DEFAULT_WORKSPACE_ID", "explainers")

    client = redis.Redis.from_url(redis_url, decode_responses=True)
    last_beat = 0.0
    print(f"[worker-manim] polling {MANIM_QUEUE_KEY}")

    while True:
        now = time.monotonic()
        if now - last_beat >= 15.0:
            try:
                depth = int(client.llen(MANIM_QUEUE_KEY))
                post_heartbeat(core_url, token, ws_id, status="Healthy", queue_depth=depth)
            except Exception as exc:  # noqa: BLE001
                print(f"[worker-manim] heartbeat warning: {exc}")
            last_beat = now

        item = client.brpop(MANIM_QUEUE_KEY, timeout=2)
        if not item:
            continue
        _, raw = item
        job = parse_manim_job(raw)
        if not job:
            print("[worker-manim] dropped malformed job")
            continue
        res = execute_manim_job(job)
        status = "Healthy" if res.ok else "Failing"
        try:
            post_heartbeat(core_url, token, ws_id, status=status, queue_depth=0)
        except Exception as exc:  # noqa: BLE001
            print(f"[worker-manim] status report warning: {exc}")


if __name__ == "__main__":
    run_daemon()
