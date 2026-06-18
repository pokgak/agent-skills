"""Pattern-based evaluator for skill-pressure tests."""

import re
from dataclasses import dataclass, field


@dataclass
class EvalResult:
    passed: bool
    matched_required: list[str] = field(default_factory=list)
    missed_required: list[str] = field(default_factory=list)
    violated_anti: list[str] = field(default_factory=list)
    raw_text: str = ""


def check_patterns(
    text: str,
    required: list[str] | None = None,
    anti: list[str] | None = None,
) -> EvalResult:
    matched = []
    missed = []
    violated = []

    for pattern in required or []:
        if re.search(pattern, text, re.IGNORECASE):
            matched.append(pattern)
        else:
            missed.append(pattern)

    for pattern in anti or []:
        if re.search(pattern, text, re.IGNORECASE):
            violated.append(pattern)

    return EvalResult(
        passed=len(missed) == 0 and len(violated) == 0,
        matched_required=matched,
        missed_required=missed,
        violated_anti=violated,
        raw_text=text,
    )
