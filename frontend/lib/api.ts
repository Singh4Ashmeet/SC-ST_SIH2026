/**
 * API client for the Yojana Setu backend (SIH26239 — Ministry of Tribal Affairs).
 *
 * JWT stored in localStorage, sent as Authorization: Bearer header.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Token helpers ────────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

export function setToken(token: string): void {
  localStorage.setItem("auth_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("auth_token");
}

// ── Generic fetch wrapper ────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  detail: string | Record<string, unknown>;

  constructor(status: number, detail: string | Record<string, unknown>) {
    const message = typeof detail === "string" ? detail : JSON.stringify(detail);
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }


  // Don't set Content-Type for FormData (browser sets boundary automatically)
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let detail: string | Record<string, unknown>;
    try {
      const body = await res.json();
      detail = body.detail || body;
    } catch {
      detail = res.statusText;
    }
    throw new ApiError(res.status, detail);
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}

// ── SWR fetcher ──────────────────────────────────────────────────────────────

export const swrFetcher = <T>(path: string): Promise<T> => apiFetch<T>(path);

// ── Auth API ─────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: string;
  user_id: string;
}

export interface UserMe {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

export async function login(creds: LoginRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(creds),
  });
}

export async function getMe(): Promise<UserMe> {
  return apiFetch<UserMe>("/api/auth/me");
}

// ── Scheme types & API ───────────────────────────────────────────────────────

export interface EligibilityRule {
  field: string;
  condition: Record<string, unknown>;
  failure_message: string;
}

export interface RequiredDocument {
  doc_type: string;
  label: string;
  required: boolean;
  accepted_formats: string[];
  validity_days?: number | null;
}

export interface WorkflowState {
  name: string;
  label: string;
  is_terminal: boolean;
}

export interface WorkflowTransition {
  from_state: string;
  to_state: string;
  trigger: string;
  allowed_roles: string[];
}

export interface SchemeConfig {
  scheme_code: string;
  version: number;
  eligibility_rules: EligibilityRule[];
  required_documents: RequiredDocument[];
  workflow_states: WorkflowState[];
  workflow_transitions: WorkflowTransition[];
  initial_state: string;
}

export interface SchemeRead {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  config: SchemeConfig;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export async function getSchemes(isActive?: boolean): Promise<SchemeRead[]> {
  const params = isActive !== undefined ? `?is_active=${isActive}` : "";
  return apiFetch<SchemeRead[]>(`/api/schemes${params}`);
}

export async function getScheme(id: string): Promise<SchemeRead> {
  return apiFetch<SchemeRead>(`/api/schemes/${id}`);
}

export async function createScheme(data: {
  code: string;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  is_active?: boolean;
}): Promise<SchemeRead> {
  return apiFetch<SchemeRead>("/api/schemes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateScheme(
  id: string,
  data: {
    name?: string;
    description?: string;
    config?: Record<string, unknown>;
    is_active?: boolean;
  }
): Promise<SchemeRead> {
  return apiFetch<SchemeRead>(`/api/schemes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function activateScheme(id: string): Promise<SchemeRead> {
  return apiFetch<SchemeRead>(`/api/schemes/${id}/activate`, { method: "POST" });
}

export async function deactivateScheme(id: string): Promise<SchemeRead> {
  return apiFetch<SchemeRead>(`/api/schemes/${id}/deactivate`, { method: "POST" });
}

export interface ValidateConfigResponse {
  valid: boolean;
  errors?: string[];
  config?: SchemeConfig;
}

export async function validateConfig(
  config: Record<string, unknown>
): Promise<ValidateConfigResponse> {
  return apiFetch<ValidateConfigResponse>("/api/schemes/validate-config", {
    method: "POST",
    body: JSON.stringify(config),
  });
}

// ── Application types & API ──────────────────────────────────────────────────

export interface ApplicationRead {
  id: string;
  scheme_id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone?: string | null;
  applicant_data: Record<string, unknown>;
  current_state: string;
  created_at: string;
  updated_at: string;
}

export async function getApplications(params?: {
  scheme_id?: string;
  current_state?: string;
  page?: number;
  page_size?: number;
}): Promise<ApplicationRead[]> {
  const searchParams = new URLSearchParams();
  if (params?.scheme_id) searchParams.set("scheme_id", params.scheme_id);
  if (params?.current_state) searchParams.set("current_state", params.current_state);
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.page_size) searchParams.set("page_size", params.page_size.toString());
  const qs = searchParams.toString();
  return apiFetch<ApplicationRead[]>(`/api/applications${qs ? `?${qs}` : ""}`);
}

export async function getApplication(id: string): Promise<ApplicationRead> {
  return apiFetch<ApplicationRead>(`/api/applications/${id}`);
}

export interface CreateApplicationRequest {
  scheme_id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone?: string;
  applicant_data: Record<string, unknown>;
}

export async function createApplication(
  data: CreateApplicationRequest
): Promise<ApplicationRead> {
  return apiFetch<ApplicationRead>("/api/applications", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Audit Log types & API ────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  application_id?: string | null;
  scheme_id?: string | null;
  actor_user_id?: string | null;
  action: string;
  from_state?: string | null;
  to_state?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
}

export async function getApplicationAuditLog(
  applicationId: string
): Promise<AuditLogEntry[]> {
  return apiFetch<AuditLogEntry[]>(`/api/applications/${applicationId}/audit-log`);
}

export interface AuditLogListResponse {
  items: AuditLogEntry[];
  total: number;
  page: number;
  page_size: number;
}

export async function getAuditLogs(params?: {
  page?: number;
  page_size?: number;
}): Promise<AuditLogListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.page_size) searchParams.set("page_size", params.page_size.toString());
  const qs = searchParams.toString();
  return apiFetch<AuditLogListResponse>(`/api/audit-log${qs ? `?${qs}` : ""}`);
}

// ── Document types & API ─────────────────────────────────────────────────────

export interface DocumentRead {
  id: string;
  application_id: string;
  doc_type: string;
  storage_key: string;
  status: "PENDING" | "VERIFIED" | "DEFICIENT";
  extracted_fields?: Record<string, unknown> | null;
  deficiency_reasons?: Array<{ code: string; message: string }> | null;
  uploaded_at: string;
  reviewed_at?: string | null;
  download_url?: string | null;
}

export async function getDocuments(applicationId: string): Promise<DocumentRead[]> {
  return apiFetch<DocumentRead[]>(`/api/applications/${applicationId}/documents`);
}

// ── Scrutiny API ─────────────────────────────────────────────────────────────

export interface DeficiencySummary {
  application_id: string;
  current_state: string;
  missing_documents: string[];
  documents: Record<
    string,
    {
      doc_type: string;
      status: string;
      deficiency_reasons: Array<{ code: string; message: string }>;
    }
  >;
}

export async function getDeficiencySummary(
  applicationId: string
): Promise<DeficiencySummary> {
  return apiFetch<DeficiencySummary>(
    `/api/applications/${applicationId}/deficiency-summary`
  );
}

export async function runDocumentScrutiny(
  applicationId: string
): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(
    `/api/applications/${applicationId}/run-document-scrutiny`,
    { method: "POST" }
  );
}

export async function runEligibilityCheck(
  applicationId: string
): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(
    `/api/applications/${applicationId}/run-eligibility-check`,
    { method: "POST" }
  );
}

export async function resubmitDocument(
  applicationId: string,
  documentId: string,
  file: File
): Promise<Record<string, unknown>> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<Record<string, unknown>>(
    `/api/applications/${applicationId}/documents/${documentId}/resubmit`,
    { method: "POST", body: formData }
  );
}

// ── Transitions API ──────────────────────────────────────────────────────────

export async function applyTransition(
  applicationId: string,
  trigger: string,
  details?: Record<string, unknown>
): Promise<ApplicationRead> {
  return apiFetch<ApplicationRead>(`/api/applications/${applicationId}/transition`, {
    method: "POST",
    body: JSON.stringify({ trigger, details }),
  });
}

export async function getAvailableTransitions(
  applicationId: string
): Promise<WorkflowTransition[]> {
  return apiFetch<WorkflowTransition[]>(
    `/api/applications/${applicationId}/available-transitions`
  );
}

// ── Post-Selection (Disbursements & Renewals) types & API ─────────────────────

export type DisbursementStatus = "PENDING" | "DISBURSED" | "FAILED" | "ON_HOLD";

export interface DisbursementRead {
  id: string;
  application_id: string;
  amount: number;
  disbursed_date?: string | null;
  status: DisbursementStatus;
  installment_number: number;
  remarks?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export type RenewalStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";

export interface RenewalRead {
  id: string;
  application_id: string;
  academic_year_or_cycle: string;
  status: RenewalStatus;
  due_date: string;
  reviewed_date?: string | null;
  reviewer_id?: string | null;
  remarks?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostSelectionSummary {
  application_id: string;
  disbursements: DisbursementRead[];
  renewals: RenewalRead[];
}

export async function getPostSelectionSummary(
  applicationId: string
): Promise<PostSelectionSummary> {
  return apiFetch<PostSelectionSummary>(
    `/api/applications/${applicationId}/post-selection-summary`
  );
}

export async function createDisbursement(
  applicationId: string,
  data: { amount: number; installment_number?: number; remarks?: string }
): Promise<DisbursementRead> {
  return apiFetch<DisbursementRead>(`/api/applications/${applicationId}/disbursements`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateDisbursement(
  disbursementId: string,
  data: { status: DisbursementStatus; remarks?: string; disbursed_date?: string }
): Promise<DisbursementRead> {
  return apiFetch<DisbursementRead>(`/api/disbursements/${disbursementId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function createRenewal(
  applicationId: string,
  data: { academic_year_or_cycle: string; due_date: string; remarks?: string }
): Promise<RenewalRead> {
  return apiFetch<RenewalRead>(`/api/applications/${applicationId}/renewals`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateRenewal(
  renewalId: string,
  data: { status: RenewalStatus; remarks?: string }
): Promise<RenewalRead> {
  return apiFetch<RenewalRead>(`/api/renewals/${renewalId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ── Stats API ────────────────────────────────────────────────────────────────

export interface RecentActivityItem {
  id: string;
  action: string;
  application_id?: string | null;
  created_at: string;
}

export interface StatsOverview {
  total_applications: number;
  applications_by_state: Record<string, number>;
  applications_by_scheme: Record<string, number>;
  deficient_count: number;
  documents_by_status: Record<string, number>;
  pending_disbursements_count: number;
  total_disbursed_amount: number;
  pending_renewals_count: number;
  recent_activity: RecentActivityItem[];
}

export async function getStatsOverview(): Promise<StatsOverview> {
  return apiFetch<StatsOverview>("/api/stats/overview");
}

export async function getSchemeStats(schemeId: string): Promise<StatsOverview> {
  return apiFetch<StatsOverview>(`/api/stats/schemes/${schemeId}`);
}

// ── Merit Engine API ─────────────────────────────────────────────────────────

export async function runMeritEvaluation(schemeId: string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/api/merit/schemes/${schemeId}/evaluate`, { method: "POST" });
}

export async function getMeritRankings(schemeId: string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/api/merit/schemes/${schemeId}/rankings`);
}

export async function getApplicationMeritScore(applicationId: string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/api/merit/applications/${applicationId}/score`);
}

export async function previewMeritScore(applicationId: string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/api/merit/applications/${applicationId}/preview`, { method: "POST" });
}

// ── Conflict Detection API ───────────────────────────────────────────────────

export async function runConflictDetection(
  applicationId: string,
  threshold?: number
): Promise<Record<string, unknown>> {
  const params = threshold !== undefined ? `?threshold=${threshold}` : "";
  return apiFetch<Record<string, unknown>>(`/api/conflicts/applications/${applicationId}/detect${params}`, { method: "POST" });
}

export async function getConflicts(params?: {
  application_id?: string;
  status_filter?: string;
}): Promise<Record<string, unknown>> {
  const searchParams = new URLSearchParams();
  if (params?.application_id) searchParams.set("application_id", params.application_id);
  if (params?.status_filter) searchParams.set("status_filter", params.status_filter);
  const qs = searchParams.toString();
  return apiFetch<Record<string, unknown>>(`/api/conflicts${qs ? `?${qs}` : ""}`);
}

export async function resolveConflict(
  conflictId: string,
  data: { status: string; resolution_remarks?: string }
): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/api/conflicts/${conflictId}/resolve`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ── Grievance API ────────────────────────────────────────────────────────────

export async function createGrievance(data: {
  applicant_name: string;
  applicant_email: string;
  application_id?: string;
  category?: string;
  description: string;
  priority?: string;
}): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>("/api/grievances", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getGrievances(params?: {
  status_filter?: string;
  priority_filter?: string;
  page?: number;
  page_size?: number;
}): Promise<Record<string, unknown>> {
  const searchParams = new URLSearchParams();
  if (params?.status_filter) searchParams.set("status_filter", params.status_filter);
  if (params?.priority_filter) searchParams.set("priority_filter", params.priority_filter);
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.page_size) searchParams.set("page_size", params.page_size.toString());
  const qs = searchParams.toString();
  return apiFetch<Record<string, unknown>>(`/api/grievances${qs ? `?${qs}` : ""}`);
}

export async function updateGrievance(
  grievanceId: string,
  data: { status?: string; resolution?: string; assigned_role?: string }
): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/api/grievances/${grievanceId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getGrievanceStats(): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>("/api/grievances/stats/overview");
}

export interface PolicySimulationResult {
  total_applicants_evaluated: number;
  current_eligible_count: number;
  proposed_eligible_count: number;
  eligible_count_delta: number;
  net_budget_delta: number;
  newly_eligible_count: number;
  newly_ineligible_count: number;
  [key: string]: any;
}

export async function runPolicySimulation(
  schemeId: string,
  data: { proposed_config: Record<string, unknown>; simulation_name?: string }
): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/api/simulations/schemes/${schemeId}/simulate`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getSimulationHistory(schemeId: string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/api/simulations/schemes/${schemeId}/history`);
}

export async function getSimulationDetail(simulationId: string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/api/simulations/${simulationId}`);
}
