"""Runner for skill-pressure tests. Invokes claude CLI with/without skill text."""

import subprocess
from dataclasses import dataclass


REASONING_SUFFIX = "\n\nDescribe your reasoning and what you would do. Do not call any tools."


@dataclass
class RunResult:
    text: str
    returncode: int


def run_prompt(prompt: str, skill_content: str | None = None, model: str = "sonnet") -> RunResult:
    full_prompt = prompt + REASONING_SUFFIX

    cmd = [
        "claude",
        "-p", full_prompt,
        "--max-turns", "1",
        "--output-format", "text",
        "--model", model,
    ]

    if skill_content:
        cmd.extend(["--append-system-prompt", skill_content])

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=120,
    )

    return RunResult(
        text=result.stdout,
        returncode=result.returncode,
    )
