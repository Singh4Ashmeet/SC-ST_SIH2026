"""
Scheme Configuration Schema & Validator.

Defines the structure of Scheme.config JSONB field:
  - WorkflowState
  - WorkflowTransition
  - RequiredDocument
  - EligibilityRule
  - SchemeConfig
"""

from typing import Any, Dict, List, Optional, Set
from pydantic import BaseModel, ConfigDict, Field, model_validator


class SchemeConfigValidationError(ValueError):
    """Specific error raised when scheme configuration validation fails."""
    def __init__(self, errors: List[str]):
        self.errors = errors
        super().__init__("; ".join(errors))


class WorkflowState(BaseModel):
    """A state in the scholarship scheme lifecycle."""
    name: str
    label: str
    is_terminal: bool = False

    model_config = ConfigDict(extra="ignore")


class WorkflowTransition(BaseModel):
    """A directed transition between two workflow states."""
    from_state: str
    to_state: str
    trigger: str
    allowed_roles: List[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")


class RequiredDocument(BaseModel):
    """Specification of a document required by the scheme."""
    doc_type: str
    label: str
    required: bool = True
    accepted_formats: List[str] = Field(default_factory=lambda: ["pdf", "jpg", "png"])
    validity_days: Optional[int] = Field(default=None, description="Validity window in days for expiry check. If not set, default (365 days) applies for applicable doc_types.")

    model_config = ConfigDict(extra="ignore")


class EligibilityRule(BaseModel):
    """An eligibility rule evaluated against applicant_data using JSON-logic."""
    field: str
    condition: Dict[str, Any]
    failure_message: str

    model_config = ConfigDict(extra="ignore")


class SchemeConfig(BaseModel):
    """Top-level scheme configuration document stored in Scheme.config."""
    scheme_code: str
    version: int = 1
    eligibility_rules: List[EligibilityRule] = Field(default_factory=list)
    required_documents: List[RequiredDocument] = Field(default_factory=list)
    workflow_states: List[WorkflowState]
    workflow_transitions: List[WorkflowTransition]
    initial_state: str

    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="after")
    def validate_workflow_integrity(self) -> "SchemeConfig":
        """Validate workflow consistency, state transitions, reachability, and document uniqueness."""
        errors: List[str] = []

        state_names: Set[str] = {s.name for s in self.workflow_states}
        terminal_states: Set[str] = {s.name for s in self.workflow_states if s.is_terminal}

        # Check for duplicate state names
        state_list = [s.name for s in self.workflow_states]
        if len(state_list) != len(state_names):
            dupes = sorted({name for name in state_list if state_list.count(name) > 1})
            errors.append(f"Duplicate state names in workflow_states: {', '.join(dupes)}")

        # 1. initial_state exists in workflow_states
        if self.initial_state not in state_names:
            errors.append(
                f"initial_state '{self.initial_state}' does not exist in defined workflow_states"
            )

        # 2. every from_state/to_state in workflow_transitions exists in workflow_states
        for idx, tr in enumerate(self.workflow_transitions):
            if tr.from_state not in state_names:
                errors.append(
                    f"Transition #{idx + 1} ('{tr.trigger}'): from_state '{tr.from_state}' does not exist in workflow_states"
                )
            if tr.to_state not in state_names:
                errors.append(
                    f"Transition #{idx + 1} ('{tr.trigger}'): to_state '{tr.to_state}' does not exist in workflow_states"
                )

        # 3. at least one terminal state is reachable from initial_state
        if not terminal_states:
            errors.append("No terminal states defined (at least one workflow_state must have is_terminal=True)")
        elif self.initial_state in state_names:
            # Build adjacency graph
            adj: Dict[str, Set[str]] = {s: set() for s in state_names}
            for tr in self.workflow_transitions:
                if tr.from_state in adj:
                    adj[tr.from_state].add(tr.to_state)

            # BFS traversal from initial_state
            visited: Set[str] = set([self.initial_state])
            queue: List[str] = [self.initial_state]
            reachable_terminal = False

            while queue:
                curr = queue.pop(0)
                if curr in terminal_states:
                    reachable_terminal = True
                    break
                for neighbor in adj.get(curr, []):
                    if neighbor not in visited:
                        visited.add(neighbor)
                        queue.append(neighbor)

            if not reachable_terminal:
                errors.append(
                    f"No terminal state is reachable from initial_state '{self.initial_state}' along defined workflow_transitions"
                )

        # 4. doc_types in required_documents are unique
        doc_types = [doc.doc_type for doc in self.required_documents]
        seen_docs: Set[str] = set()
        duplicate_docs: Set[str] = set()
        for dt in doc_types:
            if dt in seen_docs:
                duplicate_docs.add(dt)
            else:
                seen_docs.add(dt)

        if duplicate_docs:
            errors.append(
                f"Duplicate doc_type in required_documents: {', '.join(sorted(duplicate_docs))}"
            )

        if errors:
            raise SchemeConfigValidationError(errors)

        return self
