import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from daemon import build_heartbeat_payload, parse_manim_job
from sandbox import validate_manim_source
from worker import (
    ASPECT_CONFIG,
    ManimRenderJob,
    build_caption_burn_command,
    build_health_event,
    build_manim_command,
    build_rlimit_preexec,
)


class ManimWorkerTests(unittest.TestCase):
    def test_ast_sandbox_table(self) -> None:
        cases = [
            ("valid manim scene", "from manim import Scene, MathTex\nimport math\nclass Eq(Scene):\n  pass", True),
            ("blocks os import", "import os\nos.system('id')", False),
            ("blocks subprocess from-import", "from subprocess import run\nrun(['ls'])", False),
            ("blocks open builtin", "from manim import Scene\nopen('/etc/passwd')", False),
            ("blocks eval builtin", "from manim import Scene\neval('1+1')", False),
            ("rejects syntax error", "class Broken(:", False),
        ]
        for name, code, expected in cases:
            with self.subTest(name=name):
                res = validate_manim_source(code)
                self.assertEqual(res.ok, expected, f"{name}: got {res}")

    def test_native_aspect_commands(self) -> None:
        job_9x16 = ManimRenderJob(job_id="j1", scene_class="VectorDemo", python_source="", aspect_ratio="9:16")
        cmd = build_manim_command(job_9x16, Path("/tmp/scene.py"), Path("/tmp/media"))
        self.assertIn("1080,1920", cmd)
        self.assertIn("--transparent", cmd)
        self.assertEqual(ASPECT_CONFIG["16:9"].width, 1920)
        self.assertEqual(ASPECT_CONFIG["9:16"].height, 1920)

    def test_rlimit_preexec_callable(self) -> None:
        fn = build_rlimit_preexec(max_memory_bytes=1024 * 1024 * 512, max_cpu_sec=30)
        self.assertTrue(callable(fn))

    def test_caption_burn_command(self) -> None:
        cmd = build_caption_burn_command(Path("/tmp/in.mp4"), "/tmp/caps.ass", Path("/tmp/out.mp4"))
        self.assertEqual(cmd[0], "ffmpeg")
        self.assertIn("ass='/tmp/caps.ass'", cmd)

    def test_daemon_job_parsing_and_heartbeat(self) -> None:
        job = parse_manim_job('{"job_id":"m1","scene_class":"Eq","python_source":"from manim import Scene","aspect_ratio":"9:16"}')
        self.assertIsNotNone(job)
        assert job is not None
        self.assertEqual(job.aspect_ratio, "9:16")
        self.assertIsNone(parse_manim_job("bad-json"))

        hb = build_heartbeat_payload("explainers", status="Healthy", queue_depth=3)
        self.assertEqual(hb["event_type"], "worker.health_check")
        self.assertEqual(hb["node_id"], "manim")
        self.assertEqual(hb["status"], "Healthy")

    def test_health_event_shape(self) -> None:
        ev = build_health_event("Healthy", queue_depth=2)
        self.assertEqual(ev.event_type, "worker.health_check")
        self.assertEqual(ev.worker, "manim")
        self.assertEqual(ev.queue_depth, 2)


if __name__ == "__main__":
    unittest.main()
