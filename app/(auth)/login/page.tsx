"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Kanban,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Users2,
} from "lucide-react";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const cleanEmail = email.trim();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setErrorMsg("อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง");
        } else if (error.message.includes("Email not confirmed")) {
          setErrorMsg(
            "อีเมลนี้ยังไม่ได้รับการยืนยัน กรุณาเปิดลิงก์ยืนยันที่ส่งไปทางอีเมล หรือติดต่อผู้ดูแลระบบ"
          );
        } else {
          setErrorMsg(`เกิดข้อผิดพลาด: ${error.message}`);
        }
        return;
      }

      if (data?.user) {
        // Query user's profile directly
        const { data: profile } = await supabase
          .from("profiles")
          .select("*, team:teams(*)")
          .eq("id", data.user.id)
          .single();

        if (profile?.status === "pending") {
          router.push("/pending-approval");
        } else if (profile?.status === "inactive") {
          router.push("/inactive");
        } else {
          router.push("/board");
        }
      }
    } catch {
      setErrorMsg("ไม่สามารถเชื่อมต่อกับระบบได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950">
      {/* Top right theme toggle for convenience */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Left Showcase Banner (Visible on lg+) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 p-12 text-white flex-col justify-between">
        {/* Background glow effects */}
        <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-96 h-96 rounded-full bg-indigo-500/20 blur-3xl" />

        {/* Brand Header */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
              <Kanban className="w-6 h-6 text-blue-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                TaskFlow
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/30 border border-blue-400/30 text-blue-200">
                  Pro 2027
                </span>
              </h1>
              <p className="text-xs text-blue-200/80">ระบบจัดการงานประจำวันสำหรับทีมมืออาชีพ</p>
            </div>
          </div>
        </div>

        {/* Value Proposition & Feature Showcase */}
        <div className="relative z-10 my-auto py-12 max-w-lg space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs text-blue-100">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              ทำงานร่วมกันได้รวดเร็วและเป็นระบบกว่าเดิม
            </div>
            <h2 className="text-3xl font-extrabold leading-tight text-white">
              เปลี่ยนงานประจำวันที่ยุ่งเหยิง <br />
              ให้สำเร็จได้ตรงเวลาในทุกๆ วัน
            </h2>
            <p className="text-sm text-blue-100/80 leading-relaxed">
              ติดตามงานผ่านกระดาน Kanban Board 4 คอลัมน์, สรุปผลด้วย Dashboard กราฟเรียลไทม์ และส่งออกรายงานเป็น Excel/PDF ได้ในคลิกเดียว
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 pt-2">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <div className="p-2 rounded-lg bg-blue-500/20 text-blue-300 shrink-0">
                <Kanban className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Kanban Board ลื่นไหล</h4>
                <p className="text-xs text-blue-200/70">ลากวางการ์ด อัปเดตสถานะอัตโนมัติเมื่อเลยกำหนดส่ง (Overdue Alert)</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300 shrink-0">
                <Users2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">ระบบสิทธิ์ตามสายบังคับบัญชา</h4>
                <p className="text-xs text-blue-200/70">รองรับ Admin, Manager (MG), Group Leader (GL), Team Leader (TL) และ Member</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">ความปลอดภัยระดับองค์กร</h4>
                <p className="text-xs text-blue-200/70">ปลอดภัยด้วย Row Level Security (RLS) จาก PostgreSQL และ Supabase</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-blue-200/60 border-t border-white/10 pt-6">
          <span>&copy; 2026-2027 TaskFlow Team. All rights reserved.</span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> ระบบออนไลน์พร้อมใช้งาน
          </span>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile brand header */}
          <div className="lg:hidden flex items-center gap-3 pb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <Kanban className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">TaskFlow</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">ระบบจัดการงานประจำวันสำหรับทีม</p>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              ยินดีต้อนรับกลับมา 👋
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              กรอกข้อมูลเพื่อเข้าสู่ระบบบัญชีผู้ใช้ของคุณ
            </p>
          </div>

          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-3">
              <span className="shrink-0 text-base">⚠️</span>
              <p className="leading-snug">{errorMsg}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  อีเมล (Email)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    spellCheck={false}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="flex h-11 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    รหัสผ่าน (Password)
                  </label>
                  <span className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                    ลืมรหัสผ่าน?
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="flex h-11 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-10 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  จดจำการเข้าสู่ระบบ
                </span>
              </label>
            </div>

            <Button
              type="submit"
              variant="gradient"
              size="lg"
              className="w-full"
              isLoading={isLoading}
            >
              เข้าสู่ระบบ
            </Button>
          </form>

          {/* Registration link */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              ยังไม่มีบัญชีใช้งานใช่ไหม?{" "}
              <Link
                href="/register"
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                สมัครสมาชิกที่นี่
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
