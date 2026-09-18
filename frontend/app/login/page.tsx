"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Sparkles, AlertCircle, Loader2, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { user, login, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await login({ email: email.trim(), password });
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Failed to authenticate. Please verify your credentials.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillCredentials = (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
    setErrorMsg(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-sm text-slate-400">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4 relative overflow-hidden">
      {/* Subtle background ambient lights */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 shadow-xl shadow-indigo-500/20 mb-2 border border-indigo-400/30">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Scholarship Administration</h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Ministry of Tribal Affairs & Social Justice — Digital Verification & Scrutiny Portal
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl text-slate-100">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-slate-100">Portal Authentication</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Sign in with your government administrative credentials
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {errorMsg && (
                <div
                  id="login-error-alert"
                  className="flex items-start gap-2 p-3 text-xs bg-red-950/60 border border-red-800/80 rounded-lg text-red-200"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <div className="flex-1">{errorMsg}</div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email-input" className="text-xs font-medium text-slate-300">
                  Email Address
                </Label>
                <Input
                  id="email-input"
                  type="email"
                  placeholder="officer@scst.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-slate-950/60 border-slate-700/80 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password-input" className="text-xs font-medium text-slate-300">
                    Password
                  </Label>
                </div>
                <Input
                  id="password-input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-slate-950/60 border-slate-700/80 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500"
                />
              </div>

              <Button
                id="login-submit-btn"
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-medium shadow-md shadow-indigo-600/25 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Signing In...
                  </>
                ) : (
                  <>
                    Sign In to Dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </CardContent>
          </form>

          {/* Quick login demo helper */}
          <CardFooter className="pt-2 pb-5 border-t border-slate-800/80 flex flex-col items-start gap-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Quick Demo Credentials</span>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full">
              <button
                type="button"
                id="fill-super-admin-btn"
                onClick={() => fillCredentials("admin@scst.gov.in", "admin123")}
                className="text-left p-2 rounded-lg bg-slate-950/50 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/40 transition-all text-xs group"
              >
                <div className="font-semibold text-indigo-300 group-hover:text-indigo-200">Super Admin</div>
                <div className="text-[10px] text-slate-400 truncate">admin@scst.gov.in</div>
              </button>
              <button
                type="button"
                id="fill-scrutiny-btn"
                onClick={() => fillCredentials("scrutiny@scst.gov.in", "officer123")}
                className="text-left p-2 rounded-lg bg-slate-950/50 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/40 transition-all text-xs group"
              >
                <div className="font-semibold text-emerald-300 group-hover:text-emerald-200">Scrutiny Officer</div>
                <div className="text-[10px] text-slate-400 truncate">scrutiny@scst.gov.in</div>
              </button>
            </div>
          </CardFooter>
        </Card>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-500">
          Protected Government Information System • Unauthorized access is prohibited
        </div>
      </div>
    </div>
  );
}
