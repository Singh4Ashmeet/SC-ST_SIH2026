"""
Service for validating raw scheme configuration JSON documents.
"""

from typing import Any, Dict, List
from pydantic import ValidationError

from app.schemas.scheme_config import SchemeConfig, SchemeConfigValidationError


def validate_scheme_config(raw_json: Dict[str, Any]) -> SchemeConfig:
    """Validate a raw JSON dict against SchemeConfig schema and workflow rules.

    Args:
        raw_json: Raw dictionary loaded from JSON/JSONB representing scheme configuration.

    Returns:
        SchemeConfig: Validated, strongly-typed SchemeConfig instance.

    Raises:
        SchemeConfigValidationError (ValueError): If configuration fails structural or
            integrity validation, containing all collected error messages.
    """
    if not isinstance(raw_json, dict):
        raise SchemeConfigValidationError(["Scheme config payload must be a JSON object (dict)"])

    try:
        return SchemeConfig.model_validate(raw_json)
    except ValidationError as exc:
        collected_errors: List[str] = []
        for error in exc.errors():
            # If wrapped from our custom validator
            ctx_err = error.get("ctx", {}).get("error") if error.get("ctx") else None
            if isinstance(ctx_err, SchemeConfigValidationError):
                collected_errors.extend(ctx_err.errors)
            else:
                loc = " -> ".join(str(elem) for elem in error.get("loc", []))
                msg = error.get("msg", "")
                if msg.startswith("Value error, "):
                    msg = msg[len("Value error, "):]
                if loc and loc != "__root__":
                    collected_errors.append(f"[{loc}] {msg}")
                else:
                    collected_errors.append(msg)

        raise SchemeConfigValidationError(collected_errors) from exc
