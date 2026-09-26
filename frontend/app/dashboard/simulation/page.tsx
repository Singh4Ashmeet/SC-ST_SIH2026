"use client";

import React, { useState, useEffect } from "react";
import useSWR from "swr";
import { getSchemes, runPolicySimulation, type SchemeRead, type PolicySimulationResult } from "@/lib/api";
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
} from "lucide-react";

export default function PolicySimulationPage() {
  const { data: schemes } = useSWR<SchemeRead[]>("/api/schemes", getSchemes);
  const [selectedSchemeId, setSelectedSchemeId] = useState<string>("");
  const [incomeCap, setIncomeCap] = useState<number>(250000);
  const [minMarks, setMinMarks] = useState<number>(50);
  const [disbursementAmount, setDisbursementAmount] = useState<number>(50000);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [result, setResult] = useState<PolicySimulationResult | null>(null);

  useEffect(() => {
    if (schemes && schemes.length > 0 && !selectedSchemeId) {
      setSelectedSchemeId(schemes[0].id);
    }
  }, [schemes, selectedSchemeId]);

  const selectedScheme = schemes?.find((s) => s.id === selectedSchemeId);

  const handleRunSimulation = async () => {
    if (!selectedSchemeId || !selectedScheme) return;
    setSimulating(true);
    try {
      // Create modified config deep copy
      const baseConfig = selectedScheme.config || {};
      const modifiedConfig = JSON.parse(JSON.stringify(baseConfig));

      // Update eligibility rules in modified config
      modifiedConfig.eligibility_rules = [
        {
          rule_id: "SIM-INC",
          field: "annual_income",
          condition: { "<=": incomeCap },
          failure_message: `Annual income exceeds ₹${incomeCap.toLocaleString()}`,
        },
        {
          rule_id: "SIM-MRK",
          field: "marks_percentage",
          condition: { ">=": minMarks },
          failure_message: `Marks percentage below ${minMarks}%`,
        },
      ];

      const res = (await runPolicySimulation(selectedSchemeId, {
        proposed_config: modifiedConfig,
        simulation_name: `Simulation - Income ₹${incomeCap.toLocaleString()}, Marks ${minMarks}%`,
      })) as any;
      setResult(res.results || res);
    } catch (err) {
      console.error("Simulation failed:", err);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/60 rounded-xl p-6 border border-amber-200/80 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-[#de5c36]/10 text-[#de5c36] text-[10px] font-bold uppercase px-2 py-0.5 rounded border border-[#de5c36]/20">
                SANDBOX & ANALYTICS
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight mt-1 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#de5c36]" /> Policy Simulation & Impact Engine
            </h1>
            <p className="text-xs text-stone-600 mt-1 max-w-2xl">
              Simulate proposed scheme criteria changes against the applicant pool before publishing to assess financial liability, candidate eligibility deltas, and quota impact.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Simulation Controls Panel */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#de5c36]" /> Parameters Setup
          </h2>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Select Scheme</label>
            <select
              value={selectedSchemeId}
              onChange={(e) => setSelectedSchemeId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-[#de5c36] outline-none"
            >
              {schemes?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-gray-700">Annual Income Ceiling</span>
              <span className="font-mono font-bold text-[#de5c36]">₹{incomeCap.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="100000"
              max="600000"
              step="25000"
              value={incomeCap}
              onChange={(e) => setIncomeCap(Number(e.target.value))}
              className="w-full accent-[#de5c36]"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>₹1.0L</span>
              <span>₹2.5L (Default)</span>
              <span>₹6.0L</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-gray-700">Minimum Academic Cutoff</span>
              <span className="font-mono font-bold text-[#de5c36]">{minMarks}%</span>
            </div>
            <input
              type="range"
              min="40"
              max="90"
              step="5"
              value={minMarks}
              onChange={(e) => setMinMarks(Number(e.target.value))}
              className="w-full accent-[#de5c36]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Stipend / Disbursement per Beneficiary (₹)
            </label>
            <input
              type="number"
              value={disbursementAmount}
              onChange={(e) => setDisbursementAmount(Number(e.target.value))}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-800"
            />
          </div>

          <button
            onClick={handleRunSimulation}
            disabled={simulating}
            className="w-full flex items-center justify-center gap-2 bg-[#de5c36] hover:bg-[#c4502f] text-white text-xs font-semibold py-2.5 px-4 rounded-lg shadow-sm transition disabled:opacity-50"
          >
            {simulating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Simulating Pool Impact...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Run Simulation Sandbox
              </>
            )}
          </button>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2 space-y-4">
          {result ? (
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Policy Simulation Forecast Report</h3>
                  <p className="text-xs text-gray-500">Evaluated against active candidate pool ({result.total_applicants_evaluated} total applicants)</p>
                </div>
                <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                  Simulation Verified
                </span>
              </div>

              {/* Stat Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="text-[10px] uppercase font-bold text-gray-400">Current Eligible</div>
                  <div className="text-lg font-extrabold text-gray-800 mt-0.5">{result.current_eligible_count}</div>
                  <div className="text-[10px] text-gray-400">Beneficiaries</div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="text-[10px] uppercase font-bold text-gray-400">Proposed Eligible</div>
                  <div className="text-lg font-extrabold text-[#de5c36] mt-0.5">{result.proposed_eligible_count}</div>
                  <div className="text-[10px] text-gray-400">Beneficiaries</div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="text-[10px] uppercase font-bold text-gray-400">Net Eligibility Delta</div>
                  <div className={`text-lg font-extrabold mt-0.5 flex items-center gap-1 ${result.eligible_count_delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {result.eligible_count_delta >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {result.eligible_count_delta > 0 ? `+${result.eligible_count_delta}` : result.eligible_count_delta}
                  </div>
                  <div className="text-[10px] text-gray-400">Net Shift</div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="text-[10px] uppercase font-bold text-gray-400">Net Financial Delta</div>
                  <div className={`text-lg font-extrabold mt-0.5 ${result.net_budget_delta >= 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    ₹{Math.abs(result.net_budget_delta).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-gray-400">{result.net_budget_delta >= 0 ? "Additional Budget" : "Savings"}</div>
                </div>
              </div>

              {/* Candidate Transitions Breakdown */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Applicant Transition Analysis</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-4 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-emerald-900">Newly Gained Eligibility: {result.newly_eligible_count}</div>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        Students who become eligible under relaxed criteria.
                      </p>
                    </div>
                  </div>

                  <div className="bg-rose-50/70 border border-rose-200/80 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-rose-900">Disqualified under Proposal: {result.newly_ineligible_count}</div>
                      <p className="text-[11px] text-rose-700 mt-0.5">
                        Students previously eligible who would fall outside tighter bounds.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center flex flex-col items-center justify-center space-y-3">
              <Sliders className="w-8 h-8 text-gray-400" />
              <div className="text-sm font-semibold text-gray-700">No Simulation Executed</div>
              <p className="text-xs text-gray-400 max-w-sm">
                Adjust parameters on the left panel and click &quot;Run Simulation Sandbox&quot; to project financial liabilities and candidate eligibility deltas.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
