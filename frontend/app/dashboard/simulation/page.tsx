"use client";

import React, { useState, useEffect } from "react";
import useSWR from "swr";
import { getSchemes, runPolicySimulation, type SchemeRead } from "@/lib/api";
import {
  Sliders,
  Play,
  TrendingDown,
  TrendingUp,
  Users,
  IndianRupee,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  HelpCircle,
  FileCheck,
  Building,
  Target,
  Scale,
  RotateCcw,
  Check,
} from "lucide-react";

export default function PolicySimulationPage() {
  const { data: schemes } = useSWR<SchemeRead[]>("/api/schemes", getSchemes);
  const [selectedSchemeId, setSelectedSchemeId] = useState<string>("");
  const [incomeCap, setIncomeCap] = useState<number>(600000);
  const [minMarks, setMinMarks] = useState<number>(50);
  const [disbursementAmount, setDisbursementAmount] = useState<number>(372000);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [result, setResult] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"transitions" | "rules" | "workload">("transitions");
  const [presetFeedback, setPresetFeedback] = useState<string | null>(null);

  // Auto-select first scheme and load baseline values
  useEffect(() => {
    if (schemes && schemes.length > 0 && !selectedSchemeId) {
      const first = schemes[0];
      setSelectedSchemeId(first.id);
      loadSchemeBaselines(first);
    }
  }, [schemes, selectedSchemeId]);

  const selectedScheme = schemes?.find((s) => s.id === selectedSchemeId);

  const loadSchemeBaselines = (scheme: SchemeRead) => {
    const rules = (scheme.config as any)?.eligibility_rules || [];
    const incomeRule = rules.find((r: any) => r.field === "annual_income");
    if (incomeRule && incomeRule.condition) {
      // Extract income limit if present
      const cond = incomeRule.condition;
      const op = Object.keys(cond)[0];
      const val = cond[op]?.[1] ?? cond[op];
      if (typeof val === "number") {
        setIncomeCap(val);
      }
    } else {
      setIncomeCap(600000);
    }

    const marksRule = rules.find((r: any) => r.field === "percentage" || r.field === "qualifying_marks");
    if (marksRule && marksRule.condition) {
      const cond = marksRule.condition;
      const op = Object.keys(cond)[0];
      const val = cond[op]?.[1] ?? cond[op];
      if (typeof val === "number") {
        setMinMarks(val);
      }
    } else {
      setMinMarks(50);
    }
  };

  const handleSchemeChange = (schemeId: string) => {
    setSelectedSchemeId(schemeId);
    const s = schemes?.find((item) => item.id === schemeId);
    if (s) {
      loadSchemeBaselines(s);
      setResult(null);
    }
  };

  // Demo Scenarios / Presets
  const applyPreset = (type: "relax_income" | "tighten_income" | "raise_merit" | "reset") => {
    if (type === "relax_income") {
      setIncomeCap(800000);
      setMinMarks(50);
      setPresetFeedback("Preset Applied: Relaxed family income ceiling to ₹8.0 Lakhs (Outreach Expansion).");
    } else if (type === "tighten_income") {
      setIncomeCap(200000);
      setMinMarks(50);
      setPresetFeedback("Preset Applied: Strict income ceiling of ₹2.0 Lakhs (Ultra-Poverty / EWS Priority).");
    } else if (type === "raise_merit") {
      setIncomeCap(600000);
      setMinMarks(75);
      setPresetFeedback("Preset Applied: Raised academic cutoff to 75% (Elite Merit Cohort).");
    } else if (type === "reset") {
      if (selectedScheme) loadSchemeBaselines(selectedScheme);
      setPresetFeedback("Parameters reset to current ministerial baseline.");
    }
    setTimeout(() => setPresetFeedback(null), 4000);
  };

  const handleRunSimulation = async () => {
    if (!selectedSchemeId || !selectedScheme) return;
    setSimulating(true);
    try {
      const baseConfig = selectedScheme.config || {};
      const modifiedConfig = JSON.parse(JSON.stringify(baseConfig));

      // Filter out existing income and percentage rules, then replace with updated valid json-logic
      const existingRules = (modifiedConfig.eligibility_rules || []).filter(
        (r: any) => r.field !== "annual_income" && r.field !== "percentage" && r.field !== "qualifying_marks"
      );

      // Add valid json-logic condition for annual income
      existingRules.push({
        rule_id: "SIM-INC",
        field: "annual_income",
        condition: { "<=": [{ var: "annual_income" }, incomeCap] },
        failure_message: `Annual family income exceeds proposed ceiling of ₹${(incomeCap / 100000).toFixed(1)} Lakhs`,
      });

      // Add valid json-logic condition for academic percentage
      if (minMarks > 35) {
        existingRules.push({
          rule_id: "SIM-MRK",
          field: "percentage",
          condition: { ">=": [{ var: "percentage" }, minMarks] },
          failure_message: `Qualifying examination percentage below proposed cutoff of ${minMarks}%`,
        });
      }

      modifiedConfig.eligibility_rules = existingRules;
      modifiedConfig.annual_grant_amount = disbursementAmount;

      const res = (await runPolicySimulation(selectedSchemeId, {
        proposed_config: modifiedConfig,
        simulation_name: `Simulation - Income ₹${(incomeCap / 100000).toFixed(1)}L, Cutoff ${minMarks}%`,
      })) as any;

      if (res.valid === false) {
        setPresetFeedback(`Validation Error: ${(res.validation_errors || []).join(", ")}`);
      } else {
        setResult(res.results || res);
        setPresetFeedback("Simulation completed successfully! Review the impact forecast below.");
      }
    } catch (err: any) {
      console.error("Simulation failed:", err);
      setPresetFeedback(`Simulation request failed: ${err.message || "Network error"}`);
    } finally {
      setSimulating(false);
      setTimeout(() => setPresetFeedback(null), 5000);
    }
  };

  const totalApps = result?.total_applications ?? 0;
  const newlyEligible = result?.eligibility_impact?.newly_eligible ?? 0;
  const newlyIneligible = result?.eligibility_impact?.newly_ineligible ?? 0;
  const netEligibleDelta = newlyEligible - newlyIneligible;
  const netFinancial = result?.estimated_financial_impact ?? 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── HEADER BANNER ── */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-stone-950 text-white rounded-xl p-6 border border-stone-700 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="bg-amber-400 text-stone-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> POLICY IMPACT SIMULATION SANDBOX
              </span>
              <span className="text-[10px] font-mono text-stone-300 border border-stone-700 px-2 py-0.5 rounded">
                SAFE &amp; NON-MUTATING
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Sliders className="w-6 h-6 text-[#de5c36]" /> Policy Simulation &amp; Fiscal Impact Engine
            </h1>
            <p className="text-xs text-stone-300 leading-relaxed">
              Test proposed ministerial policy revisions (income ceilings, academic cutoffs, stipend levels) against the real applicant cohort in a secure sandbox. Instantly forecast beneficiary reach, financial liabilities, and administrative workload shifts before publishing updates.
            </p>
          </div>

          <div className="bg-stone-800/80 border border-stone-700 p-3 rounded-lg text-right text-xs">
            <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">Sandbox Principle</span>
            <span className="font-semibold text-stone-200">Zero Production Impact</span>
            <p className="text-[10px] text-stone-400 mt-0.5">Live student records remain untouched</p>
          </div>
        </div>
      </div>

      {/* ── 1-CLICK DEMO SCENARIO PRESETS ── */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
            <Target className="w-4 h-4 text-[#de5c36]" /> Quick Demo Scenarios (1-Click Presets):
          </div>
          {presetFeedback && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 animate-fade-in">
              {presetFeedback}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          <button
            onClick={() => applyPreset("relax_income")}
            className="p-2.5 rounded-lg border border-stone-200 bg-white hover:border-[#de5c36] hover:bg-orange-50/40 text-left transition space-y-1 shadow-sm group"
          >
            <div className="font-bold text-stone-900 group-hover:text-[#de5c36] flex items-center justify-between">
              <span>🌟 Expand Outreach</span>
              <span className="text-[10px] font-mono text-emerald-600 font-extrabold">+₹8.0L</span>
            </div>
            <p className="text-[11px] text-stone-500">Raise ceiling to ₹8 Lakhs to include middle-income ST scholars.</p>
          </button>

          <button
            onClick={() => applyPreset("tighten_income")}
            className="p-2.5 rounded-lg border border-stone-200 bg-white hover:border-[#de5c36] hover:bg-orange-50/40 text-left transition space-y-1 shadow-sm group"
          >
            <div className="font-bold text-stone-900 group-hover:text-[#de5c36] flex items-center justify-between">
              <span>🎯 Strict Priority</span>
              <span className="text-[10px] font-mono text-rose-600 font-extrabold">₹2.0L Cap</span>
            </div>
            <p className="text-[11px] text-stone-500">Focus assistance strictly on ultra-low-income families.</p>
          </button>

          <button
            onClick={() => applyPreset("raise_merit")}
            className="p-2.5 rounded-lg border border-stone-200 bg-white hover:border-[#de5c36] hover:bg-orange-50/40 text-left transition space-y-1 shadow-sm group"
          >
            <div className="font-bold text-stone-900 group-hover:text-[#de5c36] flex items-center justify-between">
              <span>🎓 Elite Merit</span>
              <span className="text-[10px] font-mono text-purple-600 font-extrabold">75% Cutoff</span>
            </div>
            <p className="text-[11px] text-stone-500">Simulate higher academic threshold for competitive fellowship cohorts.</p>
          </button>

          <button
            onClick={() => applyPreset("reset")}
            className="p-2.5 rounded-lg border border-stone-200 bg-white hover:border-stone-400 text-left transition space-y-1 shadow-sm group"
          >
            <div className="font-bold text-stone-700 flex items-center justify-between">
              <span>🔄 Reset Baseline</span>
              <RotateCcw className="w-3.5 h-3.5 text-stone-400" />
            </div>
            <p className="text-[11px] text-stone-500">Restore current official scheme rules &amp; limits.</p>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT PANEL: PARAMETERS SETUP ── */}
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 space-y-5">
          <div className="border-b border-stone-100 pb-3">
            <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#de5c36]" /> Policy Levers &amp; Criteria
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">Tune sandbox parameters to evaluate pool shifts.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Target Scheme</label>
            <select
              value={selectedSchemeId}
              onChange={(e) => handleSchemeChange(e.target.value)}
              className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs font-bold text-stone-900 focus:ring-2 focus:ring-[#de5c36]/20 outline-none"
            >
              {schemes?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Income Ceiling Slider */}
          <div className="bg-stone-50/70 p-3.5 rounded-xl border border-stone-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-stone-800">Annual Family Income Ceiling</span>
              <span className="font-mono font-black text-[#de5c36] text-sm">
                ₹{(incomeCap / 100000).toFixed(2)} Lakhs
              </span>
            </div>
            <input
              type="range"
              min="100000"
              max="1200000"
              step="25000"
              value={incomeCap}
              onChange={(e) => setIncomeCap(Number(e.target.value))}
              className="w-full accent-[#de5c36] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-stone-400">
              <span>₹1.0L (EWS)</span>
              <span>₹6.0L (Baseline)</span>
              <span>₹12.0L (Max)</span>
            </div>
          </div>

          {/* Academic Cutoff Slider */}
          <div className="bg-stone-50/70 p-3.5 rounded-xl border border-stone-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-stone-800">Minimum Qualifying Marks</span>
              <span className="font-mono font-black text-purple-700 text-sm">{minMarks}%</span>
            </div>
            <input
              type="range"
              min="35"
              max="90"
              step="5"
              value={minMarks}
              onChange={(e) => setMinMarks(Number(e.target.value))}
              className="w-full accent-purple-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-stone-400">
              <span>35% (Pass)</span>
              <span>50% (Standard)</span>
              <span>90% (Distinction)</span>
            </div>
          </div>

          {/* Fellowship Grant Amount */}
          <div className="bg-stone-50/70 p-3.5 rounded-xl border border-stone-200/80 space-y-1.5">
            <label className="block text-xs font-bold text-stone-800">
              Annual Fellowship / Grant per Scholar (₹)
            </label>
            <input
              type="number"
              value={disbursementAmount}
              onChange={(e) => setDisbursementAmount(Number(e.target.value))}
              className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-stone-900"
            />
            <span className="text-[10px] text-stone-400 block">Baseline grant rate: ₹3,72,000 / year (₹31,000/mo)</span>
          </div>

          <button
            onClick={handleRunSimulation}
            disabled={simulating}
            className="w-full flex items-center justify-center gap-2 bg-[#de5c36] hover:bg-[#c44a26] text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md transition disabled:opacity-50"
          >
            {simulating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Evaluating Cohort Impact...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                Run Policy Simulation Sandbox
              </>
            )}
          </button>
        </div>

        {/* ── RIGHT PANEL: FORECAST RESULTS ── */}
        <div className="lg:col-span-2 space-y-5">
          {result ? (
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 space-y-6">
              {/* Report Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-4">
                <div>
                  <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-emerald-600" />
                    Policy Impact Forecast &amp; Liability Report
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Evaluated against <strong>{totalApps} active applications</strong> for {selectedScheme?.code}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200">
                    SIMULATION VERIFIED
                  </span>
                  <span className="text-[10px] font-mono text-stone-400">
                    ID: {result.simulation_id ? result.simulation_id.slice(0, 8) : "SANDBOX"}
                  </span>
                </div>
              </div>

              {/* Stat Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200">
                  <div className="text-[10px] uppercase font-bold text-stone-500">Evaluated Cohort</div>
                  <div className="text-xl font-black text-stone-900 mt-1">{totalApps}</div>
                  <div className="text-[10px] text-stone-500">Applications</div>
                </div>

                <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200">
                  <div className="text-[10px] uppercase font-bold text-stone-500">Net Eligibility Shift</div>
                  <div className={`text-xl font-black mt-1 flex items-center gap-1 ${netEligibleDelta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {netEligibleDelta >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {netEligibleDelta > 0 ? `+${netEligibleDelta}` : netEligibleDelta}
                  </div>
                  <div className="text-[10px] text-stone-500">
                    {newlyEligible > 0 ? `+${newlyEligible} new` : ""}{newlyIneligible > 0 ? ` -${newlyIneligible} lost` : ""}{netEligibleDelta === 0 ? "Unchanged" : ""}
                  </div>
                </div>

                <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200">
                  <div className="text-[10px] uppercase font-bold text-stone-500">Fiscal Budget Delta</div>
                  <div className={`text-xl font-black mt-1 ${netFinancial > 0 ? "text-rose-700" : (netFinancial < 0 ? "text-emerald-700" : "text-stone-900")}`}>
                    {result.financial_impact_formatted ? result.financial_impact_formatted.split(" ")[0] : `₹${Math.abs(netFinancial).toLocaleString("en-IN")}`}
                  </div>
                  <div className="text-[10px] text-stone-500">
                    {netFinancial > 0 ? "Additional Budget" : (netFinancial < 0 ? "Estimated Savings" : "No Fiscal Delta")}
                  </div>
                </div>

                <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200">
                  <div className="text-[10px] uppercase font-bold text-stone-500">Scrutiny Workload</div>
                  <div className="text-xl font-black text-purple-700 mt-1">
                    {result.workload_impact?.percentage_workload_change ?? 0}%
                  </div>
                  <div className="text-[10px] text-stone-500">
                    +{result.workload_impact?.additional_scrutiny_reviews ?? 0} Desk Reviews
                  </div>
                </div>
              </div>

              {/* Result Navigation Tabs */}
              <div className="border-b border-stone-200 flex items-center gap-2 text-xs font-bold">
                {[
                  { key: "transitions", label: `Candidate Transitions (${result.eligibility_impact?.details?.length ?? 0})` },
                  { key: "rules", label: `Policy Rule Comparison (${result.policy_comparison_diff?.length ?? 0})` },
                  { key: "workload", label: "Workload & Administration" },
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key as any)}
                    className={`px-3 py-2 border-b-2 transition ${
                      activeTab === t.key
                        ? "border-[#de5c36] text-[#de5c36]"
                        : "border-transparent text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: CANDIDATE TRANSITIONS */}
              {activeTab === "transitions" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-stone-600">
                    <span>Granular breakdown of scholars affected by proposed policy modifications:</span>
                    <span className="font-semibold text-emerald-700">
                      {result.eligibility_impact?.unchanged ?? totalApps} Scholars Maintain Current Status
                    </span>
                  </div>

                  {(!result.eligibility_impact?.details || result.eligibility_impact.details.length === 0) ? (
                    <div className="p-6 bg-stone-50 border border-stone-200 rounded-xl text-center space-y-1.5">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                      <div className="text-xs font-bold text-stone-800">No Candidate Eligibility Displacements</div>
                      <p className="text-[11px] text-stone-500 max-w-md mx-auto">
                        All active applicants in this scheme cohort meet the proposed criteria without any status transitions.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-stone-200 border border-stone-200 rounded-xl overflow-hidden">
                      {result.eligibility_impact.details.map((d: any, idx: number) => {
                        const isGained = d.change === "became_eligible";
                        return (
                          <div key={idx} className="p-3.5 bg-white hover:bg-stone-50/50 flex items-center justify-between gap-4 text-xs">
                            <div>
                              <div className="font-bold text-stone-900">{d.applicant_name}</div>
                              <span className="text-[10px] font-mono text-stone-400">App ID: {d.application_id.slice(0, 8)}...</span>
                              {d.reasons && d.reasons.length > 0 && (
                                <p className="text-[11px] text-rose-600 mt-0.5">{d.reasons.join(", ")}</p>
                              )}
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              isGained ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-rose-100 text-rose-800 border border-rose-300"
                            }`}>
                              {isGained ? "✓ BECAME ELIGIBLE" : "⚠ DISQUALIFIED"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: POLICY RULE COMPARISON DIFF */}
              {activeTab === "rules" && (
                <div className="space-y-3">
                  <div className="overflow-x-auto border border-stone-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-stone-100/70 border-b border-stone-200 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                          <th className="p-3">Field</th>
                          <th className="p-3">Baseline Rule (Current Policy)</th>
                          <th className="p-3">Proposed Sandbox Rule</th>
                          <th className="p-3 text-center">Change State</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200">
                        {(result.policy_comparison_diff || []).map((r: any, idx: number) => (
                          <tr key={idx} className={r.is_modified ? "bg-amber-50/40" : "bg-white"}>
                            <td className="p-3 font-bold text-stone-900 uppercase text-[11px]">{r.field.replace(/_/g, " ")}</td>
                            <td className="p-3 font-mono text-[11px] text-stone-600">{r.current_rule}</td>
                            <td className="p-3 font-mono text-[11px] text-stone-900 font-semibold">{r.proposed_rule}</td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                r.is_modified ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-stone-100 text-stone-600"
                              }`}>
                                {r.is_modified ? "MODIFIED" : "UNCHANGED"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: WORKLOAD IMPACT */}
              {activeTab === "workload" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2">
                    <h4 className="font-bold text-stone-900 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-[#de5c36]" /> Desk Scrutiny Officer Workload
                    </h4>
                    <p className="text-stone-600 text-[11px] leading-relaxed">
                      Expanding eligibility increases desk verification queue volume. Each newly eligible applicant requires certificate authentication and OCR verification.
                    </p>
                    <div className="pt-2 border-t border-stone-200 space-y-1">
                      <div className="flex justify-between font-semibold">
                        <span>Additional Initial Reviews:</span>
                        <span className="text-stone-900">+{result.workload_impact?.additional_scrutiny_reviews ?? 0}</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Projected Document Deficiencies:</span>
                        <span className="text-stone-900">~{result.workload_impact?.projected_deficiency_workload ?? 0} items</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2">
                    <h4 className="font-bold text-stone-900 flex items-center gap-1.5">
                      <IndianRupee className="w-4 h-4 text-emerald-600" /> Direct Benefit Transfer (DBT) Outlay
                    </h4>
                    <p className="text-stone-600 text-[11px] leading-relaxed">
                      Financial liabilities calculated per beneficiary using the annual scholarship rate of ₹{disbursementAmount.toLocaleString("en-IN")}.
                    </p>
                    <div className="pt-2 border-t border-stone-200 space-y-1">
                      <div className="flex justify-between font-semibold">
                        <span>Rate per Scholar:</span>
                        <span className="text-stone-900">₹{disbursementAmount.toLocaleString("en-IN")} / yr</span>
                      </div>
                      <div className="flex justify-between font-bold text-emerald-800">
                        <span>Total Projected Outlay Shift:</span>
                        <span>{result.financial_impact_formatted || `₹${netFinancial.toLocaleString("en-IN")}`}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-dashed border-stone-300 p-12 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-[#de5c36]">
                <Sliders className="w-6 h-6" />
              </div>
              <div className="text-base font-bold text-stone-800">No Simulation Executed Yet</div>
              <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                Click any of the <strong>Quick Demo Scenarios</strong> above or adjust the parameter sliders on the left panel, then click <strong>&quot;Run Policy Simulation Sandbox&quot;</strong> to view forecasted beneficiary reach and fiscal impact.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
