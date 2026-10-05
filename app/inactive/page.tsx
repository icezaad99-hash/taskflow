"use client";

import React from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Ban, LogOut, Kanban, HelpCircle } from "lucide-react";

export default function InactiveAccountPage() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
            <Kanban className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            TaskFlow
          </span>
        </div>

        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <Ban className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              บัญชีนี้ถูกปิดการใช้งานชั่วคราว ⛔
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              สิทธิ์การเข้าถึงระบบของคุณถูกระงับชั่วคราว หากท่านคิดว่าเป็นข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบ (Admin) เพื่อขอเปิดใช้งาน
            </p>
          </div>

          <div className="pt-2">
            <Button
              onClick={signOut}
              variant="outline"
              size="md"
              className="w-full gap-2 text-slate-600 dark:text-slate-300"
            >
              <LogOut className="w-4 h-4" />
              ออกจากระบบ
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
