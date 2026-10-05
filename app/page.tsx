"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Loader2, Kanban } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { user, profile, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace("/login");
      } else if (profile?.status === "pending") {
        router.replace("/pending-approval");
      } else if (profile?.status === "inactive") {
        router.replace("/inactive");
      } else {
        router.replace("/board");
      }
    }
  }, [user, profile, isLoading, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center">
      <div className="space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-500/25">
          <Kanban className="w-6 h-6 animate-pulse" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">TaskFlow</h2>
          <p className="text-xs text-slate-400">กำลังเข้าสู่ระบบ...</p>
        </div>
        <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400 mx-auto mt-4" />
      </div>
    </div>
  );
}
