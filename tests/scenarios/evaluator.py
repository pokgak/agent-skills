"""Weighted evaluator for scenario test results."""

import re
from dataclasses import dataclass, field

from .runner import ScenarioResult


@dataclass
class EvalScore:
    required_tools: dict = field(default_factory=dict)
    required_patterns: dict = field(default_factory=dict)
    anti_patterns: dict = field(default_factory=dict)
    tool_ordering: dict = field(default_factory=dict)
    recommended_tools: dict = field(default_factory=dict)
    total_score: float = 0.0

    WEIGHTS = {
        "required_tools": 0.30,
        "required_patterns": 0.25,
        "anti_patterns": 0.20,
        "tool_ordering": 0.15,
        "recommended_tools": 0.10,
    }


def evaluate(result: ScenarioResult, expected: dict) -> EvalScore:
    score = EvalScore()
    tool_names = [tc.name for tc in result.tool_calls]
    search_text = result.raw_arguments + " " + result.text_output

    # Required tools
    req_tools = expected.get("required_tools", [])
    if req_tools:
        found = [t for t in req_tools if t in tool_names]
        missing = [t for t in req_tools if t not in tool_names]
        ratio = len(found) / len(req_tools)
    else:
        found, missing, ratio = [], [], 1.0
    score.required_tools = {"found": found, "missing": missing, "ratio": ratio}

    # Required patterns (searched in tool arguments + text output)
    req_patterns = expected.get("required_patterns", [])
    if req_patterns:
        matched = [p for p in req_patterns if re.search(p, search_text, re.IGNORECASE)]
        missed = [p for p in req_patterns if not re.search(p, search_text, re.IGNORECASE)]
        ratio = len(matched) / len(req_patterns)
    else:
        matched, missed, ratio = [], [], 1.0
    score.required_patterns = {"matched": matched, "missed": missed, "ratio": ratio}

    # Anti-patterns
    anti = expected.get("anti_patterns", [])
    if anti:
        violations = [p for p in anti if re.search(p, search_text, re.IGNORECASE)]
        ratio = 1.0 - (len(violations) / len(anti))
    else:
        violations, ratio = [], 1.0
    score.anti_patterns = {"violations": violations, "ratio": ratio}

    # Tool ordering
    orderings = expected.get("tool_ordering", [])
    if orderings:
        correct = 0
        for seq in orderings:
            indices = []
            for tool in seq:
                try:
                    idx = tool_names.index(tool)
                    indices.append(idx)
                except ValueError:
                    indices.append(-1)
            if all(i >= 0 for i in indices) and indices == sorted(indices):
                correct += 1
        ratio = correct / len(orderings)
    else:
        correct, ratio = 0, 1.0
    score.tool_ordering = {"correct": correct, "total": len(orderings), "ratio": ratio}

    # Recommended tools
    rec_tools = expected.get("recommended_tools", [])
    if rec_tools:
        found = [t for t in rec_tools if t in tool_names]
        missing = [t for t in rec_tools if t not in tool_names]
        ratio = len(found) / len(rec_tools)
    else:
        found, missing, ratio = [], [], 1.0
    score.recommended_tools = {"found": found, "missing": missing, "ratio": ratio}

    # Weighted total
    score.total_score = sum(
        getattr(score, component)["ratio"] * weight
        for component, weight in EvalScore.WEIGHTS.items()
    )

    return score
