from pathlib import Path

import pytest
import yaml


REPO_ROOT = Path(__file__).parent.parent
SKILLS_DIR = REPO_ROOT / "skills"
LGTM_SKILL_DIR = SKILLS_DIR / "lgtm"
LGTM_SKILL_FILE = LGTM_SKILL_DIR / "SKILL.md"


@pytest.fixture
def skill_content() -> str:
    return LGTM_SKILL_FILE.read_text()


def load_yaml_scenarios(yaml_path: Path) -> list[dict]:
    data = yaml.safe_load(yaml_path.read_text())
    return data.get("scenarios", [])
