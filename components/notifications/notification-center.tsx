"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  CircleAlert,
  ClipboardCheck,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Notification, NotificationType } from "@/types/database";

const notificationIcons: Record<NotificationType, LucideIcon> = {
  task_assigned: ClipboardCheck,
  task_comment: MessageCircle,
  task_status_changed: RefreshCw,
  task_overdue: CircleAlert,
  system: Bell,
};

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function NotificationCenter() {
  const { user, profile, isLoading: authLoading, isActive } = useAuth();
  const router = useRouter();
  const userId = user?.id;
  const [supabase] = useState(() => createClient());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    if (!userId || !isActive) return;

    try {
      const { data, error: queryError } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (queryError) throw queryError;
      setError("");
      setNotifications((data || []) as Notification[]);
    } catch (loadError) {
      console.error("Could not load notifications:", loadError);
      setError("โหลดรายการแจ้งเตือนไม่สำเร็จ โปรดลองอีกครั้ง");
    }
  }, [isActive, supabase, userId]);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      router.replace("/login");
      return;
    }
    if (profile?.status === "pending") {
      router.replace("/pending-approval");
      return;
    }
    if (profile?.status === "inactive") {
      router.replace("/inactive");
      return;
    }
    if (!isActive) return;

    let mounted = true;
    const initializeNotifications = async () => {
      await Promise.resolve();
      if (!mounted) return;
      await loadNotifications();
      if (mounted) setLoading(false);
    };
    void initializeNotifications();

    const channel = supabase
      .channel(`notifications-page-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => void loadNotifications()
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Could not subscribe to notification updates:", status);
        }
      });

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [authLoading, isActive, loadNotifications, profile?.status, router, supabase, userId]);

  async function updateReadState(notification: Notification, isRead: boolean) {
    if (!user || busy || busyId) return;
    setBusyId(notification.id);
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ is_read: isRead })
        .eq("id", notification.id)
        .eq("user_id", user.id);

      if (updateError) throw updateError;
      setNotifications((current) =>
        current.map((item) => item.id === notification.id ? { ...item, is_read: isRead } : item)
      );
    } catch (updateError) {
      console.error("Could not update notification read state:", updateError);
      setError("บันทึกสถานะการอ่านไม่สำเร็จ โปรดลองอีกครั้ง");
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    if (!user || busy || busyId) return;
    setBusy(true);
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (updateError) throw updateError;
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    } catch (updateError) {
      console.error("Could not mark all notifications as read:", updateError);
      setError("ทำเครื่องหมายว่าอ่านทั้งหมดไม่สำเร็จ โปรดลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;
  const accessPending = authLoading || !user || Boolean(user && isActive);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold uppercase text-sky-700 dark:text-sky-300">TASKFLOW / UPDATES</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">การแจ้งเตือน</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {unreadCount} รายการที่ยังไม่ได้อ่าน
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} disabled={busy || Boolean(busyId)}>
              <CheckCheck className="h-4 w-4" />
              อ่านทั้งหมด
            </Button>
          )}
        </div>

        {error && (
          <div role="alert" className="mb-4 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            <CircleAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void loadNotifications()}>
              ลองอีกครั้ง
            </Button>
          </div>
        )}

        {accessPending && (loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            กำลังโหลดการแจ้งเตือน...
          </div>
        ) : notifications.length === 0 && !error ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
            <Bell className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">ยังไม่มีการแจ้งเตือน</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">การแจ้งเตือนใหม่จะแสดงที่หน้านี้</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {notifications.map((notification) => {
              const Icon = notificationIcons[notification.type];
              return (
                <li
                  key={notification.id}
                  className={`rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 ${
                    notification.is_read
                      ? "border-slate-200 dark:border-slate-800"
                      : "border-sky-200 ring-1 ring-sky-100 dark:border-sky-900 dark:ring-sky-950"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 rounded-lg p-2 ${notification.is_read ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{notification.title}</h2>
                        <time dateTime={notification.created_at} className="text-xs text-slate-400">
                          {formatCreatedAt(notification.created_at)}
                        </time>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{notification.message}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {notification.task_id && (
                          <Link href={`/board?task=${encodeURIComponent(notification.task_id)}`} className="text-xs font-medium text-sky-700 hover:underline dark:text-sky-300">
                            ไปที่งาน
                          </Link>
                        )}
                        <button
                          type="button"
                          disabled={busyId === notification.id || busy}
                          onClick={() => void updateReadState(notification, !notification.is_read)}
                          className="text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                          {busyId === notification.id ? "กำลังบันทึก..." : notification.is_read ? "ทำเครื่องหมายว่ายังไม่อ่าน" : "ทำเครื่องหมายว่าอ่านแล้ว"}
                        </button>
                      </div>
                    </div>
                    {!notification.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-label="ยังไม่อ่าน" />}
                  </div>
                </li>
              );
            })}
          </ul>
        ))}

        {user && !accessPending && profile?.status !== "pending" && profile?.status !== "inactive" && (
          <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            ไม่พบข้อมูลสถานะบัญชีของคุณ จึงไม่สามารถโหลดการแจ้งเตือนได้
          </div>
        )}
      </main>
    </div>
  );
}
