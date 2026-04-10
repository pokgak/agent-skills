"""
Skill routing tests.

For each skill, verifies that the model selects the correct skill (or no skill)
given a user query, based on the skill descriptions in each SKILL.md frontmatter.

Requires ANTHROPIC_API_KEY to be set.
"""

import json
import re
from pathlib import Path

import anthropic
import pytest

SKILLS_DIR = Path(__file__).parent.parent / "skills"
MODEL = "claude-haiku-4-5-20251001"


def load_skills() -> dict[str, str]:
    """Return {skill_name: description} for all skills with a SKILL.md."""
    skills = {}
    for skill_md in SKILLS_DIR.glob("*/SKILL.md"):
        text = skill_md.read_text()
        match = re.search(r"^description:\s*(.+)$", text, re.MULTILINE)
        name_match = re.search(r"^name:\s*(.+)$", text, re.MULTILINE)
        if match and name_match:
            skills[name_match.group(1).strip()] = match.group(1).strip()
    return skills


def load_trigger_evals() -> list[tuple[str, str, bool]]:
    """Return list of (skill_name, query, should_trigger) tuples."""
    cases = []
    for eval_file in SKILLS_DIR.glob("*/trigger_evals.json"):
        data = json.loads(eval_file.read_text())
        skill = data["skill"]
        for query in data.get("should_trigger", []):
            cases.append((skill, query, True))
        for query in data.get("should_not_trigger", []):
            cases.append((skill, query, False))
    return cases


SKILLS = load_skills()
EVAL_CASES = load_trigger_evals()


def select_skill(query: str) -> str | None:
    """
    Ask the model which skill (if any) to use for the given query.
    Returns the skill name, or None if no skill applies.
    """
    skill_list = "\n".join(
        f'- name: "{name}"\n  description: "{desc}"'
        for name, desc in SKILLS.items()
    )
    prompt = f"""You are a routing assistant. Given a user query, decide which skill (if any) to activate.

Available skills:
{skill_list}

User query: "{query}"

Reply with a JSON object: {{"skill": "<name>"}} if a skill applies, or {{"skill": null}} if none apply.
Reply with JSON only, no explanation."""

    client = anthropic.Anthropic()
    message = client.messages.create(
        model=MODEL,
        max_tokens=64,
        messages=[{"role": "user", "content": prompt}],
    )
    text = message.content[0].text.strip()
    result = json.loads(text)
    return result.get("skill")


def pytest_generate_tests(metafunc):
    if "eval_case" in metafunc.fixturenames:
        ids = [
            f"{skill}-{'trigger' if should else 'no_trigger'}-{query[:40]}"
            for skill, query, should in EVAL_CASES
        ]
        metafunc.parametrize("eval_case", EVAL_CASES, ids=ids)


def test_routing(eval_case):
    skill_name, query, should_trigger = eval_case
    selected = select_skill(query)

    if should_trigger:
        assert selected == skill_name, (
            f"Expected skill '{skill_name}' to be selected for query: {query!r}\n"
            f"Got: {selected!r}"
        )
    else:
        assert selected != skill_name, (
            f"Expected skill '{skill_name}' NOT to be selected for query: {query!r}\n"
            f"But it was selected."
        )
