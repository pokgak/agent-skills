"""Compare with-skill vs without-skill scenario results."""

from dataclasses import dataclass

from .evaluator import EvalScore


REGRESSION_THRESHOLD = -0.1


@dataclass
class Comparison:
    scenario_id: str
    with_skill_score: float
    without_skill_score: float
    delta: float
    verdict: str  # "improved", "regressed", "neutral"


def compare(
    scenario_id: str,
    with_skill: EvalScore,
    without_skill: EvalScore,
) -> Comparison:
    delta = with_skill.total_score - without_skill.total_score

    if delta > 0.05:
        verdict = "improved"
    elif delta < REGRESSION_THRESHOLD:
        verdict = "regressed"
    else:
        verdict = "neutral"

    return Comparison(
        scenario_id=scenario_id,
        with_skill_score=with_skill.total_score,
        without_skill_score=without_skill.total_score,
        delta=delta,
        verdict=verdict,
    )


def format_results(comparisons: list[Comparison]) -> str:
    lines = [
        f"{'Scenario':<45} {'With':>6} {'Without':>8} {'Delta':>6} {'Verdict':<10}",
        "-" * 80,
    ]
    for c in comparisons:
        lines.append(
            f"{c.scenario_id:<45} {c.with_skill_score:>6.2f} "
            f"{c.without_skill_score:>8.2f} {c.delta:>+6.2f} {c.verdict:<10}"
        )

    improved = sum(1 for c in comparisons if c.verdict == "improved")
    regressed = sum(1 for c in comparisons if c.verdict == "regressed")
    neutral = sum(1 for c in comparisons if c.verdict == "neutral")
    lines.append("-" * 80)
    lines.append(f"Summary: {improved} improved, {neutral} neutral, {regressed} regressed")

    return "\n".join(lines)
