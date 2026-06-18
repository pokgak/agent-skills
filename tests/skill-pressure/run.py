#!/usr/bin/env python3
"""Run skill-pressure tests for the LGTM skill.

Tests whether the SKILL.md content changes model reasoning in expected ways.
Runs Claude with and without skill text, checking for required/anti patterns.

Usage:
    python tests/skill-pressure/run.py                  # all scenarios
    python tests/skill-pressure/run.py lgtm             # specific file
    python tests/skill-pressure/run.py --skill-only     # skip baseline
    python tests/skill-pressure/run.py --model opus     # override model
"""

import argparse
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).parent.parent))

from conftest import LGTM_SKILL_FILE

from evaluator import check_patterns
from runner import run_prompt

SCENARIOS_DIR = Path(__file__).parent / "scenarios"


def load_scenarios(filter_name: str | None = None) -> list[tuple[str, dict]]:
    results = []
    for yaml_file in sorted(SCENARIOS_DIR.glob("*.yml")):
        if filter_name and yaml_file.stem != filter_name:
            continue
        data = yaml.safe_load(yaml_file.read_text())
        for scenario in data.get("scenarios", []):
            results.append((data.get("skill", "lgtm"), scenario))
    return results


def run_tests(
    filter_name: str | None = None,
    skill_only: bool = False,
    model: str = "sonnet",
) -> bool:
    skill_content = LGTM_SKILL_FILE.read_text()
    scenarios = load_scenarios(filter_name)

    if not scenarios:
        print(f"No scenarios found{f' matching {filter_name}' if filter_name else ''}")
        return False

    print(f"\nRunning {len(scenarios)} skill-pressure scenarios (model: {model})\n")

    passed = 0
    failed = 0
    errors = 0

    for skill_name, scenario in scenarios:
        sid = scenario["id"]
        prompt = scenario["prompt"]

        print(f"  {sid}:")

        # --- Baseline (without skill) ---
        if not skill_only:
            baseline_spec = scenario.get("without_skill", {})
            baseline_patterns = baseline_spec.get("expected_patterns", [])

            if baseline_patterns:
                print(f"    baseline... ", end="", flush=True)
                try:
                    baseline_result = run_prompt(prompt, skill_content=None, model=model)
                    baseline_eval = check_patterns(
                        baseline_result.text,
                        required=baseline_patterns,
                    )
                    status = "RED (expected)" if baseline_eval.passed else "not RED"
                    print(status)
                except Exception as e:
                    print(f"ERROR: {e}")

        # --- With skill ---
        with_spec = scenario.get("with_skill", {})
        required = with_spec.get("required_patterns", [])
        anti = with_spec.get("anti_patterns", [])

        print(f"    with skill... ", end="", flush=True)
        try:
            skill_result = run_prompt(prompt, skill_content=skill_content, model=model)
            skill_eval = check_patterns(skill_result.text, required=required, anti=anti)

            if skill_eval.passed:
                print("PASS")
                passed += 1
            else:
                print("FAIL")
                failed += 1
                if skill_eval.missed_required:
                    print(f"      missed: {skill_eval.missed_required}")
                if skill_eval.violated_anti:
                    print(f"      violations: {skill_eval.violated_anti}")
        except Exception as e:
            print(f"ERROR: {e}")
            errors += 1

    print(f"\nResults: {passed} passed, {failed} failed, {errors} errors")
    return failed == 0 and errors == 0


def main():
    parser = argparse.ArgumentParser(description="Run LGTM skill-pressure tests")
    parser.add_argument("filter", nargs="?", help="Filter by scenario file name")
    parser.add_argument("--skill-only", action="store_true", help="Skip baseline runs")
    parser.add_argument("--model", default="sonnet", help="Model to use (default: sonnet)")
    args = parser.parse_args()

    success = run_tests(
        filter_name=args.filter,
        skill_only=args.skill_only,
        model=args.model,
    )
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
