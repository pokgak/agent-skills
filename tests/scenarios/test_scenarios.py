"""End-to-end scenario tests comparing with-skill vs without-skill behavior."""

import json
from pathlib import Path

import pytest
import yaml

from .runner import run_scenario
from .evaluator import evaluate
from .comparator import compare, format_results, REGRESSION_THRESHOLD


DEFINITIONS_DIR = Path(__file__).parent / "definitions"


def load_all_scenarios():
    scenarios = []
    for yaml_file in sorted(DEFINITIONS_DIR.glob("*.yml")):
        data = yaml.safe_load(yaml_file.read_text())
        for scenario in data.get("scenarios", []):
            scenarios.append(scenario)
    return scenarios


def scenario_ids():
    return [s["id"] for s in load_all_scenarios()]


def get_scenario(scenario_id: str) -> dict:
    for s in load_all_scenarios():
        if s["id"] == scenario_id:
            return s
    raise ValueError(f"Scenario {scenario_id} not found")


class TestScenarios:
    @pytest.mark.core
    @pytest.mark.slow
    @pytest.mark.parametrize("scenario_id", scenario_ids())
    def test_scenario_comparison(self, scenario_id):
        """Run scenario with and without skill, assert no regression."""
        scenario = get_scenario(scenario_id)
        prompt = scenario["prompt"]
        expected = scenario.get("expected", {})
        config = scenario.get("config", {})
        max_turns = config.get("max_turns", 8)
        timeout = config.get("timeout_ms", 180000) // 1000

        # Run with skill
        with_result = run_scenario(
            scenario_id=scenario_id,
            prompt=prompt,
            with_skill=True,
            max_turns=max_turns,
            timeout=timeout,
        )
        with_score = evaluate(with_result, expected)

        # Run without skill
        without_result = run_scenario(
            scenario_id=scenario_id,
            prompt=prompt,
            with_skill=False,
            max_turns=max_turns,
            timeout=timeout,
        )
        without_score = evaluate(without_result, expected)

        comp = compare(scenario_id, with_score, without_score)

        # Save comparison result
        output_dir = Path(__file__).parent / "output"
        output_dir.mkdir(parents=True, exist_ok=True)
        results_file = output_dir / "_comparison_results.json"

        results = []
        if results_file.exists():
            try:
                results = json.loads(results_file.read_text())
            except json.JSONDecodeError:
                results = []

        results = [r for r in results if r.get("scenario_id") != scenario_id]
        results.append({
            "scenario_id": comp.scenario_id,
            "with_skill_score": comp.with_skill_score,
            "without_skill_score": comp.without_skill_score,
            "delta": comp.delta,
            "verdict": comp.verdict,
            "with_skill_details": {
                "required_tools": with_score.required_tools,
                "required_patterns": with_score.required_patterns,
                "anti_patterns": with_score.anti_patterns,
            },
            "without_skill_details": {
                "required_tools": without_score.required_tools,
                "required_patterns": without_score.required_patterns,
                "anti_patterns": without_score.anti_patterns,
            },
        })
        results_file.write_text(json.dumps(results, indent=2))

        assert comp.delta >= REGRESSION_THRESHOLD, (
            f"Regression detected for {scenario_id}: "
            f"delta={comp.delta:.2f} (threshold={REGRESSION_THRESHOLD})\n"
            f"With skill: {comp.with_skill_score:.2f}, "
            f"Without skill: {comp.without_skill_score:.2f}"
        )

    @pytest.mark.slow
    @pytest.mark.parametrize("scenario_id", scenario_ids())
    def test_scenario_with_skill_only(self, scenario_id):
        """Run scenario with skill only, check minimum score threshold."""
        scenario = get_scenario(scenario_id)
        prompt = scenario["prompt"]
        expected = scenario.get("expected", {})
        config = scenario.get("config", {})
        max_turns = config.get("max_turns", 8)
        timeout = config.get("timeout_ms", 180000) // 1000

        result = run_scenario(
            scenario_id=scenario_id,
            prompt=prompt,
            with_skill=True,
            max_turns=max_turns,
            timeout=timeout,
        )
        score = evaluate(result, expected)

        assert score.total_score >= 0.6, (
            f"Score too low for {scenario_id}: {score.total_score:.2f} (min: 0.6)\n"
            f"Required tools missing: {score.required_tools.get('missing', [])}\n"
            f"Required patterns missed: {score.required_patterns.get('missed', [])}\n"
            f"Anti-pattern violations: {score.anti_patterns.get('violations', [])}"
        )
