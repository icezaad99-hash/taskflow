"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import { Navbar } from "@/components/layout/navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RoleBadge, StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Profile, Role, AccountStatus } from "@/types/database";
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Search,
  Shield,
  Filter,
  CheckCircle,
  AlertCircle,
  MoreVertical,
  ChevronDown,
  RefreshCw,
  Loader2,
} from "lucide-react";

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, profile, isAdmin, isActive, isLoading: authLoading } = useAuth();
  const [supabase] = useState(() => createClient());

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, team:teams(*)")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching profiles:", error.message);
        setFeedbackMsg({ type: "error", text: `เกิดข้อผิดพลาดในการโหลดข้อมูล: ${error.message}` });
      } else {
        setProfiles((data as Profile[]) || []);
      }
    } catch (err: unknown) {
      console.error(err);
      setFeedbackMsg({
        type: "error",
        text: err instanceof Error ? err.message : "โหลดรายชื่อสมาชิกไม่สำเร็จ",
      });
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    let active = true;
    async function initializeAdminPage() {
      await Promise.resolve();
      if (!active || authLoading) return;
      if (!user) {
        router.replace("/login");
        return;
      }
      if (!isActive) {
        router.replace(profile?.status === "pending" ? "/pending-approval" : "/inactive");
        return;
      }
      if (!isAdmin) {
        router.replace("/board");
        return;
      }
      await fetchUsers();
    }
    void initializeAdminPage();
    return () => {
      active = false;
    };
  }, [authLoading, fetchUsers, isActive, isAdmin, profile?.status, router, user]);

  // Actions
  const handleApprove = async (profileId: string) => {
    setUpdatingId(profileId);
    setFeedbackMsg(null);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "active" })
        .eq("id", profileId);

      if (error) throw error;

      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, status: "active" } : p))
      );
      setFeedbackMsg({ type: "success", text: "อนุมัติการใช้งานสมาชิกเรียบร้อยแล้ว ✅" });
    } catch (err: unknown) {
      setFeedbackMsg({ type: "error", text: `ไม่สามารถอนุมัติได้: ${err instanceof Error ? err.message : "โปรดลองอีกครั้ง"}` });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusChange = async (profileId: string, newStatus: AccountStatus) => {
    setUpdatingId(profileId);
    setFeedbackMsg(null);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: newStatus })
        .eq("id", profileId);

      if (error) throw error;

      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, status: newStatus } : p))
      );
      setFeedbackMsg({ type: "success", text: `เปลี่ยนสถานะเป็น ${newStatus} สำเร็จ` });
    } catch (err: unknown) {
      setFeedbackMsg({ type: "error", text: `เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : "โปรดลองอีกครั้ง"}` });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRoleChange = async (profileId: string, newRole: Role) => {
    setUpdatingId(profileId);
    setFeedbackMsg(null);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", profileId);

      if (error) throw error;

      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, role: newRole } : p))
      );
      setFeedbackMsg({ type: "success", text: `อัปเดตบทบาทเป็น ${newRole.toUpperCase()} เรียบร้อยแล้ว` });
    } catch (err: unknown) {
      setFeedbackMsg({ type: "error", text: `เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : "โปรดลองอีกครั้ง"}` });
    } finally {
      setUpdatingId(null);
    }
  };

  // Stats calculation
  const totalUsers = profiles.length;
  const pendingUsers = profiles.filter((p) => p.status === "pending").length;
  const activeUsers = profiles.filter((p) => p.status === "active").length;
  const leaderUsers = profiles.filter((p) => ["admin", "mg", "gl", "tl"].includes(p.role)).length;

  // Filtered list
  const filteredProfiles = profiles.filter((p) => {
    const matchesSearch =
      (p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const matchesRole = roleFilter === "all" || p.role === roleFilter;

    return matchesSearch && matchesStatus && matchesRole;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">
              <Shield className="w-3.5 h-3.5" /> แผงควบคุมผู้ดูแลระบบ (Admin Panel)
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              จัดการสมาชิกและสิทธิ์การใช้งาน
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              อนุมัติสมาชิกใหม่, กำหนดบทบาทสายงาน (Admin, MG, GL, TL, Member) และตั้งค่าสถานะบัญชี
            </p>
          </div>

          <Button
            onClick={fetchUsers}
            variant="outline"
            size="sm"
            isLoading={isLoading}
            className="gap-2 self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" /> รีเฟรชข้อมูล
          </Button>
        </div>

        {/* Feedback message banner */}
        {feedbackMsg && (
          <div
            className={`p-4 rounded-2xl flex items-center justify-between border ${
              feedbackMsg.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                : "bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
            }`}
          >
            <span className="text-sm font-medium">{feedbackMsg.text}</span>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="text-xs underline hover:opacity-75"
            >
              ปิด
            </button>
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">ผู้ใช้ทั้งหมด</p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{totalUsers}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className={pendingUsers > 0 ? "border-amber-400/80 bg-amber-50/20 dark:bg-amber-950/20 shadow-xs" : ""}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">รออนุมัติ</p>
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{pendingUsers}</h3>
                  {pendingUsers > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white animate-pulse">
                      ต้องการดำเนินการ
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">ใช้งานอยู่</p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{activeUsers}</h3>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">แอดมิน / หัวหน้า</p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{leaderUsers}</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search Bar */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาตามชื่อ หรือ อีเมลสมาชิก..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              {/* Status and Role Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Status tabs */}
                <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs font-medium">
                  {[
                    { id: "all", label: "ทั้งหมด" },
                    { id: "pending", label: `รออนุมัติ (${pendingUsers})` },
                    { id: "active", label: "ใช้งานอยู่" },
                    { id: "inactive", label: "ปิดใช้งาน" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setStatusFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-lg transition-colors ${
                        statusFilter === tab.id
                          ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Role select */}
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="all">ทุกบทบาท (All Roles)</option>
                  <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                  <option value="mg">MG (Manager)</option>
                  <option value="gl">GL (Group Leader)</option>
                  <option value="tl">TL (Team Leader)</option>
                  <option value="member">Member (สมาชิก)</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th scope="col" className="px-6 py-4">สมาชิก</th>
                  <th scope="col" className="px-6 py-4">บทบาท (Role)</th>
                  <th scope="col" className="px-6 py-4">ทีม / สังกัด</th>
                  <th scope="col" className="px-6 py-4">สถานะ</th>
                  <th scope="col" className="px-6 py-4">วันที่สมัคร</th>
                  <th scope="col" className="px-6 py-4 text-right">การจัดการ (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                        <span>กำลังโหลดรายชื่อสมาชิก...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredProfiles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      ไม่พบข้อมูลสมาชิกตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  filteredProfiles.map((p) => {
                    const isRowUpdating = updatingId === p.id;
                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Member Info */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white font-semibold flex items-center justify-center shrink-0 shadow-2xs">
                              {p.full_name ? p.full_name.charAt(0).toUpperCase() : "U"}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {p.full_name}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {p.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role Selector */}
                        <td className="px-6 py-4">
                          <select
                            value={p.role}
                            disabled={isRowUpdating || p.role === "admin"}
                            onChange={(e) => handleRoleChange(p.id, e.target.value as Role)}
                            className="text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {p.role === "admin" && <option value="admin">👑 Admin (แอดมิน)</option>}
                            <option value="mg">👔 MG (Manager)</option>
                            <option value="gl">👥 GL (Group Leader)</option>
                            <option value="tl">🧑‍💼 TL (Team Leader)</option>
                            <option value="member">👤 Member (สมาชิก)</option>
                          </select>
                        </td>

                        {/* Team */}
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-xs">
                          {p.team?.name || "ส่วนกลาง / ไม่มีสังกัด"}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <StatusBadge status={p.status} />
                        </td>

                        {/* Date Created */}
                        <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(p.created_at, "th")}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            {p.status === "pending" && (
                              <Button
                                size="sm"
                                variant="primary"
                                isLoading={isRowUpdating}
                                onClick={() => handleApprove(p.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 shadow-2xs"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> อนุมัติทันที
                              </Button>
                            )}

                            {p.status === "active" && p.role !== "admin" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                isLoading={isRowUpdating}
                                onClick={() => handleStatusChange(p.id, "inactive")}
                                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              >
                                ปิดใช้งาน
                              </Button>
                            ) : p.status === "inactive" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                isLoading={isRowUpdating}
                                onClick={() => handleStatusChange(p.id, "active")}
                                className="text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              >
                                เปิดใช้งาน
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );
}
