.PHONY: dev-web dev-core dev-architect dev-desktop test

dev-web:
	cd frontend/web && bun run dev

dev-core:
	cd backend/core && zig build run

dev-architect:
	cd backend/worker-agents && bun --env-file=../../.env src/architect-http.ts

dev-desktop:
	cd frontend/desktop && bun run dev

test:
	cd backend/core && zig build test
	cd backend/worker-agents && bun run typecheck && bun test
	python3 -m unittest discover -s backend/worker-manim/tests -v
	cd frontend/web && bun test && bun run build
