"""
Eligibility evaluation engine using json-logic-py.

Evaluates scheme eligibility rules against applicant data and returns
detailed results for both pass/fail cases.
"""

from dataclasses import dataclass
from functools import reduce
from typing import Any, List, Optional

from app.schemas.scheme_config import EligibilityRule, SchemeConfig


def jsonLogic(tests, data=None):
    """Evaluate json-logic rules against data. Fixed version compatible with Python 3."""
    if tests is None or type(tests) != dict:
        return tests

    data = data or {}

    op = list(tests.keys())[0]
    values = tests[op]

    operations = {
        "==": lambda a, b: a == b,
        "===": lambda a, b: a is b,
        "!=": lambda a, b: a != b,
        "!==": lambda a, b: a is not b,
        ">": lambda a, b: a > b,
        ">=": lambda a, b: a >= b,
        "<": lambda a, b, c=None: a < b if c is None else (a < b) and (b < c),
        "<=": lambda a, b, c=None: a <= b if c is None else (a <= b) and (b <= c),
        "!": lambda a: not a,
        "%": lambda a, b: a % b,
        "and": lambda *args: all(args),
        "or": lambda *args: any(args),
        "?:": lambda a, b, c: b if a else c,
        "log": lambda a: a if __import__('sys').stdout.write(str(a)) else a,
        "in": lambda a, b: a in b if hasattr(b, '__contains__') else False,
        "var": lambda a, not_found=None: _get_var(data, a, not_found),
        "cat": lambda *args: ''.join(str(x) for x in args),
        "+": lambda *args: sum(float(x) for x in args),
        "*": lambda *args: reduce(lambda x, y: x * y, [float(x) for x in args], 1.0),
        "-": lambda a, b=None: -a if b is None else a - b,
        "/": lambda a, b=None: a if b is None else float(a) / float(b),
        "min": lambda *args: min(args),
        "max": lambda *args: max(args),
        "count": lambda *args: sum(1 if a else 0 for a in args),
    }

    if op not in operations:
        raise RuntimeError("Unrecognized operation %s" % op)

    if type(values) not in [list, tuple]:
        values = [values]

    values = [jsonLogic(val, data) for val in values]

    return operations[op](*values)


def _get_var(data, a, not_found=None):
    """Extract variable from data using dot notation."""
    return reduce(
        lambda d, key: (
            d.get(key, not_found)
            if isinstance(d, dict)
            else d[int(key)]
            if (isinstance(d, (list, tuple)) and str(key).lstrip("-").isdigit())
            else not_found
        ),
        str(a).split("."),
        data
    )


@dataclass
class FailedRule:
    """Details of a single failed eligibility rule."""
    field: str
    failure_message: str
    condition: dict


@dataclass
class EligibilityResult:
    """Result of evaluating all eligibility rules for an applicant."""
    passed: bool
    failed_rules: List[FailedRule]


def _extract_vars(condition: dict) -> set:
    """Recursively extract all variable names referenced in a json-logic condition."""
    vars_found = set()
    if not isinstance(condition, dict):
        return vars_found
    for key, value in condition.items():
        if key == "var" and isinstance(value, str):
            vars_found.add(value)
        elif isinstance(value, dict):
            vars_found.update(_extract_vars(value))
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    vars_found.update(_extract_vars(item))
    return vars_found


def _has_missing_vars(condition: dict, data: dict) -> List[str]:
    """Check if any variables in condition are missing from data."""
    required_vars = _extract_vars(condition)
    missing = [var for var in required_vars if var not in data]
    return missing


def evaluate_eligibility(scheme_config: SchemeConfig, applicant_data: dict) -> EligibilityResult:
    """
    Evaluate all eligibility rules against applicant data.

    Args:
        scheme_config: The scheme configuration containing eligibility_rules
        applicant_data: Dictionary of applicant data to evaluate against

    Returns:
        EligibilityResult with passed=True if all rules pass,
        or passed=False with all failed rules collected (no short-circuiting)
    """
    failed_rules: List[FailedRule] = []

    for rule in scheme_config.eligibility_rules:
        # Check for missing required fields before attempting evaluation
        missing_vars = _has_missing_vars(rule.condition, applicant_data)
        if missing_vars:
            for missing_var in missing_vars:
                failed_rules.append(FailedRule(
                    field=missing_var,
                    failure_message=f"Missing required field: {missing_var}",
                    condition=rule.condition
                ))
            continue

        # Evaluate the rule condition using json-logic
        try:
            result = jsonLogic(rule.condition, applicant_data)
        except Exception as exc:
            # If evaluation fails for any reason, treat as failure
            failed_rules.append(FailedRule(
                field=rule.field,
                failure_message=f"Rule evaluation error: {str(exc)}",
                condition=rule.condition
            ))
            continue

        if not result:
            failed_rules.append(FailedRule(
                field=rule.field,
                failure_message=rule.failure_message,
                condition=rule.condition
            ))

    passed = len(failed_rules) == 0
    return EligibilityResult(passed=passed, failed_rules=failed_rules)