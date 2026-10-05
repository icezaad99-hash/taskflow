import * as React from "react";
import { cn } from "@/lib/utils";
import { Role, AccountStatus, TaskPriority, TaskStatus } from "@/types/database";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "danger" | "purple";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantStyles = {
    default: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
    secondary: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    outline: "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    danger: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    purple: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border shadow-xs transition-colors",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const configs: Record<Role, { label: string; variant: BadgeProps["variant"] }> = {
    admin: { label: "ผู้ดูแลระบบ (Admin)", variant: "purple" },
    mg: { label: "ผู้จัดการ (MG)", variant: "default" },
    gl: { label: "หัวหน้ากลุ่ม (GL)", variant: "default" },
    tl: { label: "หัวหน้าทีม (TL)", variant: "success" },
    member: { label: "สมาชิก (Member)", variant: "secondary" },
  };

  const config = configs[role] || { label: role, variant: "secondary" };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function StatusBadge({ status }: { status: AccountStatus }) {
  const configs: Record<AccountStatus, { label: string; variant: BadgeProps["variant"] }> = {
    active: { label: "ใช้งานอยู่ (Active)", variant: "success" },
    pending: { label: "รออนุมัติ (Pending)", variant: "warning" },
    inactive: { label: "ปิดใช้งาน (Inactive)", variant: "danger" },
  };

  const config = configs[status] || { label: status, variant: "secondary" };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
