"""Scenario runner. Invokes claude CLI with/without skill and captures tool calls."""

import json
import subprocess
from dataclasses import dataclass, field
from pathlib import Path


OUTPUT_DIR = Path(__file__).parent / "output"


@dataclass
class ToolCall:
    name: str
    arguments: dict = field(default_factory=dict)


@dataclass
class ScenarioResult:
    scenario_id: str
    mode: str  # "with-skill" or "without-skill"
    tool_calls: list[ToolCall] = field(default_factory=list)
    raw_arguments: str = ""
    text_output: str = ""
    skills_used: list[str] = field(default_factory=list)
    returncode: int = 0


def extract_tool_calls(ndjson_lines: list[str]) -> tuple[list[ToolCall], list[str], str]:
    """Extract tool calls, skill invocations, and text from NDJSON output."""
    tool_calls = []
    skills = []
    text_parts = []

    for line in ndjson_lines:
        line = line.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue

        if event.get("type") != "assistant":
            continue

        for block in event.get("message", {}).get("content", []):
            if block.get("type") == "tool_use":
                name = block.get("name", "")
                args = block.get("input", {})

                if name == "Skill":
                    skill_name = args.get("skill", "")
                    skills.append(skill_name)
                elif name == "Task":
                    tool_calls.append(ToolCall(name=name, arguments=args))
                else:
                    tool_calls.append(ToolCall(name=name, arguments=args))

            elif block.get("type") == "text":
                text_parts.append(block.get("text", ""))

    raw_args = json.dumps([tc.arguments for tc in tool_calls])
    return tool_calls, skills, raw_args


def run_scenario(
    scenario_id: str,
    prompt: str,
    with_skill: bool = True,
    max_turns: int = 8,
    timeout: int = 180,
) -> ScenarioResult:
    mode = "with-skill" if with_skill else "without-skill"
    out_dir = OUTPUT_DIR / scenario_id
    out_dir.mkdir(parents=True, exist_ok=True)

    allowed_tools = "Bash,Read,Glob,Grep"
    if with_skill:
        allowed_tools += ",Skill,Task"

    cmd = [
        "claude",
        "-p", prompt,
        "--output-format", "stream-json",
        "--verbose",
        "--max-turns", str(max_turns),
        "--allowedTools", allowed_tools,
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return ScenarioResult(
            scenario_id=scenario_id,
            mode=mode,
            returncode=-1,
        )

    ndjson_path = out_dir / f"{mode}.ndjson"
    ndjson_path.write_text(result.stdout)

    if result.returncode != 0:
        stderr_path = out_dir / f"{mode}.stderr"
        stderr_path.write_text(result.stderr)

    ndjson_lines = result.stdout.strip().split("\n")
    tool_calls, skills, raw_args = extract_tool_calls(ndjson_lines)

    text_parts = []
    for line in ndjson_lines:
        try:
            event = json.loads(line.strip())
            if event.get("type") == "assistant":
                for block in event.get("message", {}).get("content", []):
                    if block.get("type") == "text":
                        text_parts.append(block.get("text", ""))
        except (json.JSONDecodeError, KeyError):
            continue

    return ScenarioResult(
        scenario_id=scenario_id,
        mode=mode,
        tool_calls=tool_calls,
        raw_arguments=raw_args,
        text_output="\n".join(text_parts),
        skills_used=skills,
        returncode=result.returncode,
    )
