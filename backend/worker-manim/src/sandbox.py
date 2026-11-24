"""AST-based static safety validator for AI-generated Manim CE scene scripts."""

from __future__ import annotations

import ast
from dataclasses import dataclass

ALLOWED_IMPORTS = frozenset({"manim", "math", "numpy", "typing"})
BLOCKED_CALLS = frozenset({"eval", "exec", "open", "__import__", "compile", "breakpoint", "input"})


@dataclass(frozen=True)
class ValidationResult:
    ok: bool
    reason: str | None = None


def validate_manim_source(source: str) -> ValidationResult:
    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        return ValidationResult(ok=False, reason=f"syntax error: {exc.msg}")

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".")[0]
                if root not in ALLOWED_IMPORTS:
                    return ValidationResult(ok=False, reason=f"disallowed import: {alias.name}")
        elif isinstance(node, ast.ImportFrom):
            root = (node.module or "").split(".")[0]
            if root not in ALLOWED_IMPORTS:
                return ValidationResult(ok=False, reason=f"disallowed from-import: {node.module}")
        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id in BLOCKED_CALLS:
                return ValidationResult(ok=False, reason=f"disallowed builtin call: {node.func.id}")

    return ValidationResult(ok=True)
