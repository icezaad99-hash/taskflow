"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { AccountStatus } from "@/types/database";
import {
  Clock,
  LogOut,
  RefreshCw,
  User,
  Mail,
  Calendar,
  Kanban,
  LogIn,
} from "lucide-react";

export default function PendingApprovalPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const { user, profile, signOut } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<AccountStatus>(profile?.status || "pending");

  // Check on mount if already active
  useEffect(() => {
    let active = true;
    const autoCheck = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (active && (prof?.status === "pending" || prof?.status === "active" || prof?.status === "inactive")) {
          setCurrentStatus(prof.status);
          if (prof.status === "active") {
            router.replace("/board");
          }
        }
      }
    };
    void autoCheck();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  const handleCheckStatus = async () => {
    setIsChecking(true);
    setMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setMessage("ยังไม่มีเซสชันเข้าสู่ระบบ กรุณากดปุ่ม 'ไปหน้าเข้าสู่ระบบ' ด้านล่างเพื่อล็อกอิน");
        return;
      }

      const { data: prof, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) {
        setMessage(`เกิดข้อผิดพลาดในการตรวจสอบ: ${error.message}`);
        return;
      }

      if (prof?.status === "active") {
        setMessage("อนุมัติเรียบร้อยแล้ว! กำลังเข้าสู่หน้ากระดานงาน...");
        setTimeout(() => {
          router.replace("/board");
        }, 500);
      } else {
        const status: AccountStatus = prof?.status === "inactive" ? "inactive" : "pending";
        setCurrentStatus(status);
        setMessage(`สถานะปัจจุบัน: ${status} หากบัญชียังรออนุมัติ โปรดติดต่อผู้ดูแลระบบ`);
      }
    } catch (err: unknown) {
      setMessage(`ไม่สามารถตรวจสอบสถานะได้: ${err instanceof Error ? err.message : "โปรดลองอีกครั้ง"}`);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-lg space-y-6">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
            <Kanban className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            TaskFlow
          </span>
        </div>

        {/* Card */}
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-6 text-center">
          {/* Animated Status Icon */}
          <div className="relative mx-auto w-20 h-20 rounded-3xl bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-inner">
            <Clock className="w-10 h-10 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              บัญชีอยู่ระหว่างรอการอนุมัติ ⏳
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
              บัญชีของคุณลงทะเบียนเรียบร้อยแล้ว และระบบได้ส่งคำขอไปยัง <strong>ผู้ดูแลระบบ (Admin)</strong> เพื่อตรวจสอบและเปิดใช้งาน
            </p>
          </div>

          {/* Account Details Box */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 text-left space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              ข้อมูลบัญชีผู้ใช้ของคุณ
            </div>

            <div className="grid grid-cols-1 gap-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" /> ชื่อ-นามสกุล:
                </span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {profile?.full_name || "สมาชิกใหม่"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" /> อีเมล:
                </span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {profile?.email || user?.email || "ไม่พบข้อมูลอีเมล"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" /> วันที่สมัคร:
                </span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {formatDate(profile?.created_at || new Date().toISOString(), "th")}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/40">
                <span className="text-slate-500 dark:text-slate-400">สถานะปัจจุบัน:</span>
                <StatusBadge status={currentStatus} />
              </div>
            </div>
          </div>

          {message && (
            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs sm:text-sm text-blue-800 dark:text-blue-300">
              {message}
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2.5 pt-2">
            <Button
              onClick={handleCheckStatus}
              isLoading={isChecking}
              variant="primary"
              size="lg"
              className="w-full gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              ตรวจสอบสถานะอีกครั้ง
            </Button>

            <div className="flex gap-2">
              <Button
                onClick={() => router.push("/login")}
                variant="outline"
                size="md"
                className="flex-1 gap-1.5 text-blue-600 dark:text-blue-400"
              >
                <LogIn className="w-4 h-4" />
                ไปหน้าเข้าสู่ระบบ
              </Button>

              <Button
                onClick={signOut}
                variant="outline"
                size="md"
                className="flex-1 gap-1.5 text-slate-600 dark:text-slate-300"
              >
                <LogOut className="w-4 h-4" />
                ออกจากระบบ
              </Button>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 text-left">
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              หากยังไม่ได้ยืนยันอีเมล โปรดใช้ลิงก์ยืนยันที่ได้รับทางอีเมล หากไม่พบลิงก์ให้ติดต่อผู้ดูแลระบบ
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
