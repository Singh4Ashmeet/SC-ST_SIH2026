"""
Scheme Configuration Schema & Validator.

Yojana Setu (SIH26239) — Ministry of Tribal Affairs
AI-enabled Scholarship & Fellowship Management System for Scheduled Tribes.

Defines the structure of Scheme.config JSONB field:
  - WorkflowState
  - WorkflowTransition
  - RequiredDocument
  - EligibilityRule
  - MeritCriterion
  - SLARule
  - NotificationRule
  - ConflictRule
  - PreferenceRule
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
    issuing_authority: Optional[str] = Field(default=None, description="Expected issuing authority for validation")
    ocr_fields: List[str] = Field(default_factory=list, description="Fields expected from OCR extraction")

    model_config = ConfigDict(extra="ignore")


class EligibilityRule(BaseModel):
    """An eligibility rule evaluated against applicant_data using JSON-logic."""
    field: str
    condition: Dict[str, Any]
    failure_message: str

    model_config = ConfigDict(extra="ignore")


class MeritCriterion(BaseModel):
    """A weighted criterion for merit-based scoring and ranking."""
    name: str = Field(description="Display name of the criterion")
    field: str = Field(description="Field key in applicant_data to read score from")
    weight: float = Field(ge=0, le=100, description="Weight as percentage (0-100)")
    max_score: float = Field(default=100, ge=0, description="Maximum possible score for this criterion")
    description: Optional[str] = Field(default=None)

    model_config = ConfigDict(extra="ignore")


class SLARule(BaseModel):
    """SLA rule for a workflow stage with escalation timing."""
    stage: str = Field(description="Workflow state name this SLA applies to")
    duration_hours: int = Field(ge=1, description="SLA duration in hours")
    warning_hours: Optional[int] = Field(default=None, description="Hours before breach to show warning")
    escalation_role: Optional[str] = Field(default=None, description="Role to escalate to on breach")

    model_config = ConfigDict(extra="ignore")


class NotificationRule(BaseModel):
    """Notification trigger configuration."""
    event: str = Field(description="Event triggering the notification (e.g. application_submitted, eligibility_passed)")
    channels: List[str] = Field(default_factory=lambda: ["portal"], description="Channels: portal, email, sms")
    template: Optional[str] = Field(default=None, description="Message template with {placeholders}")
    recipient: str = Field(default="applicant", description="Target: applicant, officer, institute")

    model_config = ConfigDict(extra="ignore")


class ConflictRule(BaseModel):
    """Cross-scheme conflict detection rule."""
    incompatible_schemes: List[str] = Field(default_factory=list, description="Scheme codes that cannot be held concurrently")
    policy: str = Field(default="concurrent_prohibited", description="Policy type: concurrent_prohibited, requires_review")
    matching_fields: List[str] = Field(default_factory=lambda: ["applicant_name", "date_of_birth", "mobile"], description="Fields used for beneficiary matching")

    model_config = ConfigDict(extra="ignore")


class PreferenceRule(BaseModel):
    """Preference factor for merit scoring tiebreaking."""
    name: str = Field(description="Preference factor name")
    field: str = Field(description="Field key in applicant_data")
    condition: Dict[str, Any] = Field(description="JSON-logic condition that grants preference")
    bonus_points: float = Field(default=0, ge=0, description="Additional points added to merit score")
    description: Optional[str] = Field(default=None)

    model_config = ConfigDict(extra="ignore")


class FormFieldOption(BaseModel):
    """Option for select or multiselect form fields."""
    value: str
    label: str
    model_config = ConfigDict(extra="ignore")


class FormFieldSchema(BaseModel):
    """Specification of an applicant form field."""
    key: str = Field(description="Unique field key matching applicant_data / rules")
    label: str = Field(description="Human readable field label")
    type: str = Field(default="text", description="Field input type: text, number, date, select, multiselect, boolean, textarea, email")
    required: bool = Field(default=False, description="Whether this field is mandatory")
    placeholder: Optional[str] = None
    help_text: Optional[str] = None
    options: Optional[List[Any]] = Field(default=None, description="Selectable options (strings or FormFieldOption objects)")
    validation: Optional[Dict[str, Any]] = Field(default=None, description="Client/server validation constraints")
    model_config = ConfigDict(extra="ignore")


class FormSchema(BaseModel):
    """Declarative schema for dynamically generated scheme application form."""
    fields: List[FormFieldSchema] = Field(default_factory=list)
    model_config = ConfigDict(extra="ignore")


class SchemeConfig(BaseModel):
    """Top-level scheme configuration document stored in Scheme.config."""
    scheme_code: str
    version: int = 1
    form_schema: Optional[FormSchema] = Field(default=None, description="Declarative dynamic application form schema")
    eligibility_rules: List[EligibilityRule] = Field(default_factory=list)
    required_documents: List[RequiredDocument] = Field(default_factory=list)
    merit_criteria: List[MeritCriterion] = Field(default_factory=list)
    preference_rules: List[PreferenceRule] = Field(default_factory=list)
    workflow_states: List[WorkflowState]
    workflow_transitions: List[WorkflowTransition]
    initial_state: str
    sla_rules: List[SLARule] = Field(default_factory=list)
    notification_rules: List[NotificationRule] = Field(default_factory=list)
    conflict_rules: List[ConflictRule] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="after")
    def validate_workflow_integrity(self) -> "SchemeConfig":
        """Validate workflow consistency, state transitions, reachability, document uniqueness, and merit weights."""
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

        # 5. merit_criteria weights must total 100% if any are defined
        if self.merit_criteria:
            total_weight = sum(c.weight for c in self.merit_criteria)
            if abs(total_weight - 100.0) > 0.01:
                errors.append(
                    f"Merit criteria weights must total 100%, got {total_weight:.2f}%"
                )

        # 6. SLA rules reference valid workflow states
        for sla in self.sla_rules:
            if sla.stage not in state_names:
                errors.append(
                    f"SLA rule references unknown workflow state '{sla.stage}'"
                )

        if errors:
            raise SchemeConfigValidationError(errors)

        return self

