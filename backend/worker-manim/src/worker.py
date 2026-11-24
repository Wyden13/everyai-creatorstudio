"""EveryAI CreatorStudio — Manim CE Worker (Milestone 0 bootstrap)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

WorkerStatus = Literal["Healthy", "Working", "Failing"]


@dataclass(frozen=True)
class HealthCheckEvent:
    event_type: Literal["worker.health_check"]
    worker: Literal["manim"]
    status: WorkerStatus
    timestamp: str
    queue_depth: int
    last_error: str | None = None


def build_health_event(status: WorkerStatus, queue_depth: int = 0, last_error: str | None = None) -> HealthCheckEvent:
    return HealthCheckEvent(
        event_type="worker.health_check",
        worker="manim",
        status=status,
        timestamp=datetime.now(timezone.utc).isoformat(),
        queue_depth=queue_depth,
        last_error=last_error,
    )


if __name__ == "__main__":
    ev = build_health_event("Healthy")
    print(f"[worker-manim] bootstrap ready: {ev}")
