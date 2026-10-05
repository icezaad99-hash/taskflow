"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  LoaderCircle,
  Printer,
  RefreshCw,
  Target,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { rolePermissions } from "@/lib/permissions";
import { Task, TaskPriority, TaskStatus } from "@/types/database";

type Period = "day" | "week" | "month" | "year";

interface DashboardTask extends Pick<
  Task,
  "id" | "title" | "assignee_id" | "priority" | "status" | "due_date" | "completed_date" | "created_at" | "updated_at"
> {
  assignee?: { id: string; full_name: string } | null;
}

interface TeamRow {
  id: string;
  name: string;
  assigned: number;
  completed: number;
}

interface TrendBucket {
  key: string;
  label: string;
  start: Date;
  end: Date;
  completed: number;
}

const periodOptions: { id: Period; label: string; count: number; unit: string }[] = [
  { id: "day", label: "วัน", count: 7, unit: "7 วันล่าสุด" },
  { id: "week", label: "สัปดาห์", count: 8, unit: "8 สัปดาห์ล่าสุด" },
  { id: "month", label: "เดือน", count: 12, unit: "12 เดือนล่าสุด" },
  { id: "year", label: "ปี", count: 5, unit: "5 ปีล่าสุด" },
];

const statusMeta: Record<TaskStatus, { label: string; color: string }> = {
  todo: { label: "รอทำ", color: "#0284c7" },
  in_progress: { label: "กำลังทำ", color: "#d97706" },
  done: { label: "เสร็จแล้ว", color: "#059669" },
  overdue: { label: "งานค้าง", color: "#e11d48" },
};

const priorityMeta: Record<TaskPriority, { label: string; color: string }> = {
  low: { label: "ต่ำ", color: "#64748b" },
  medium: { label: "กลาง", color: "#d97706" },
  high: { label: "สูง", color: "#e11d48" },
};

function startOfPeriod(date: Date, period: Period) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  if (period === "day") return start;
  if (period === "week") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return start;
  }
  if (period === "month") {
    start.setDate(1);
    return start;
  }
  start.setMonth(0, 1);
  return start;
}

function shiftPeriod(date: Date, period: Period, amount: number) {
  const shifted = new Date(date);
  if (period === "day") shifted.setDate(shifted.getDate() + amount);
  if (period === "week") shifted.setDate(shifted.getDate() + amount * 7);
  if (period === "month") shifted.setMonth(shifted.getMonth() + amount);
  if (period === "year") shifted.setFullYear(shifted.getFullYear() + amount);
  return shifted;
}

function createBuckets(period: Period): TrendBucket[] {
  const option = periodOptions.find((item) => item.id === period)!;
  const anchor = startOfPeriod(new Date(), period);
  return Array.from({ length: option.count }, (_, index) => {
    const start = shiftPeriod(anchor, period, index - option.count + 1);
    const end = shiftPeriod(start, period, 1);
    let label: string;
    if (period === "day") {
      label = new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric" }).format(start);
    } else if (period === "week") {
      label = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(start);
    } else if (period === "month") {
      label = new Intl.DateTimeFormat("th-TH", { month: "short", year: "2-digit" }).format(start);
    } else {
      label = new Intl.DateTimeFormat("th-TH", { year: "numeric" }).format(start);
    }
    return { key: start.toISOString(), label, start, end, completed: 0 };
  });
}

function asLocalDate(date: string) {
  return new Date(`${date.slice(0, 10)}T00:00:00`);
}

function effectiveStatus(task: DashboardTask): TaskStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (task.status !== "done" && task.due_date && asLocalDate(task.due_date) < today) return "overdue";
  return task.status;
}

function formatDate(date: string | null) {
  if (!date) return "ไม่กำหนด";
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(asLocalDate(date));
}

function ChartPanel({ title, subtitle, children, className = "" }: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:break-inside-avoid print:border-slate-300 print:shadow-none sm:p-5 ${className}`}>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white print:text-black">{title}</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 print:text-slate-600">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

export function DashboardView() {
  const { user, profile, isActive, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [period, setPeriod] = useState<Period>("month");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const loadTasks = useCallback(async () => {
    setError("");
    let taskQuery = supabase
      .from("tasks")
      .select("id, title, assignee_id, priority, status, due_date, completed_date, created_at, updated_at, assignee:profiles!tasks_assignee_id_fkey(id, full_name)")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });
    if (profile?.role === "member" && user) {
      taskQuery = taskQuery.eq("assignee_id", user.id);
    }
    const { data, error: queryError } = await taskQuery;
    if (queryError) {
      console.error("Could not load dashboard tasks:", queryError);
      setError("โหลดข้อมูล Dashboard ไม่สำเร็จ โปรดลองอีกครั้ง");
      return;
    }
    setTasks((data || []) as unknown as DashboardTask[]);
  }, [profile?.role, supabase, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
    } else if (profile?.status === "pending") {
      router.replace("/pending-approval");
    } else if (profile?.status === "inactive") {
      router.replace("/inactive");
    }
  }, [authLoading, profile?.status, router, user]);

  useEffect(() => {
    async function initializeDashboard() {
      await Promise.resolve();
      if (authLoading) return;
      if (user && isActive) {
        setLoading(true);
        await loadTasks();
        setLoading(false);
      } else {
        setLoading(false);
      }
    }
    void initializeDashboard();
  }, [authLoading, isActive, loadTasks, user]);

  const summary = useMemo(() => {
    const counts: Record<TaskStatus, number> = { todo: 0, in_progress: 0, done: 0, overdue: 0 };
    const teamMap = new Map<string, TeamRow>();
    const buckets = createBuckets(period);
    const currentTasks = tasks.map((task) => ({ task, status: effectiveStatus(task) }));

    for (const { task, status } of currentTasks) {
      counts[status] += 1;
      if (task.assignee_id) {
        const teamRow = teamMap.get(task.assignee_id) || {
          id: task.assignee_id,
          name: task.assignee?.full_name || "ไม่ทราบชื่อ",
          assigned: 0,
          completed: 0,
        };
        teamRow.assigned += status !== "done" ? 1 : 0;
        teamMap.set(task.assignee_id, teamRow);
      }

      if (status === "done") {
        const completionDate = task.completed_date || task.updated_at.slice(0, 10);
        const date = asLocalDate(completionDate);
        const bucket = buckets.find((item) => date >= item.start && date < item.end);
        if (bucket) {
          bucket.completed += 1;
          if (task.assignee_id) {
            const teamRow = teamMap.get(task.assignee_id) || {
              id: task.assignee_id,
              name: task.assignee?.full_name || "ไม่ทราบชื่อ",
              assigned: 0,
              completed: 0,
            };
            teamRow.completed += 1;
            teamMap.set(task.assignee_id, teamRow);
          }
        }
      }
    }

    const team = Array.from(teamMap.values()).sort((left, right) => right.completed - left.completed || right.assigned - left.assigned);
    const statusData = (Object.keys(statusMeta) as TaskStatus[]).map((status) => ({
      name: statusMeta[status].label,
      value: counts[status],
      color: statusMeta[status].color,
    }));
    const highlights = currentTasks
      .filter(({ task, status }) => status === "overdue" || (status !== "done" && task.priority === "high"))
      .sort((left, right) => {
        const overdueOrder = Number(right.status === "overdue") - Number(left.status === "overdue");
        if (overdueOrder) return overdueOrder;
        return (left.task.due_date || "9999-12-31").localeCompare(right.task.due_date || "9999-12-31");
      })
      .slice(0, 6);

    return { counts, team, buckets, statusData, highlights };
  }, [period, tasks]);

  const successRate = tasks.length ? Math.round((summary.counts.done / tasks.length) * 100) : 0;
  const periodLabel = periodOptions.find((option) => option.id === period)?.unit || "";
  const dashboardScope = profile ? rolePermissions[profile.role].dashboardScope : "personal";
  const dashboardTitle = dashboardScope === "personal"
    ? "ภาพรวมงานส่วนตัว"
    : dashboardScope === "team"
      ? "ภาพรวมทีม"
      : dashboardScope === "department"
        ? "ภาพรวมฝ่าย"
        : "ภาพรวมองค์กร";

  async function exportExcel() {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const summaryRows = [
        { รายการ: "รายงาน TaskFlow", ค่า: new Date().toLocaleDateString("th-TH") },
        { รายการ: "งานทั้งหมด", ค่า: tasks.length },
        { รายการ: "รอทำ", ค่า: summary.counts.todo },
        { รายการ: "กำลังทำ", ค่า: summary.counts.in_progress },
        { รายการ: "เสร็จแล้ว", ค่า: summary.counts.done },
        { รายการ: "งานค้าง", ค่า: summary.counts.overdue },
        { รายการ: "อัตราความสำเร็จ (%)", ค่า: successRate },
        { รายการ: "ช่วงแนวโน้ม", ค่า: periodLabel },
      ];
      const taskRows = tasks.map((task) => ({
        ชื่องาน: task.title,
        ผู้รับผิดชอบ: task.assignee?.full_name || "ไม่ระบุ",
        สถานะ: statusMeta[effectiveStatus(task)].label,
        ความสำคัญ: priorityMeta[task.priority].label,
        กำหนดเสร็จ: task.due_date || "",
        วันที่เสร็จ: task.completed_date || "",
        วันที่สร้าง: task.created_at.slice(0, 10),
      }));
      const teamRows = summary.team.map((person) => ({
        ผู้รับผิดชอบ: person.name,
        งานที่ยังดูแล: person.assigned,
        งานที่เสร็จในช่วง: person.completed,
      }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "สรุป");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(taskRows), "รายการงาน");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(teamRows), "รายคน");
      XLSX.writeFile(workbook, `taskflow-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (exportError) {
      console.error("Could not export Excel report:", exportError);
      setError("ส่งออก Excel ไม่สำเร็จ");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 print:bg-white">
      <div className="print:hidden"><Navbar /></div>
      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 print:max-w-none print:px-0 print:py-0">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 print:border-slate-300">
          <div>
            <p className="text-xs font-semibold uppercase text-sky-700 dark:text-sky-300 print:text-slate-600">TASKFLOW / ANALYTICS</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white print:text-black">{dashboardTitle}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 print:text-slate-600">
              {dashboardScope === "personal" ? "งานที่มอบหมายให้คุณ กำหนดส่ง และสถิติส่วนตัว" : "สถานะงานในขอบเขตที่คุณดูแล"} · แนวโน้มย้อนหลัง {periodLabel}
            </p>
          </div>
          {user && !authLoading && <div className="flex flex-wrap items-center gap-2 print:hidden">
            <div role="group" aria-label="ช่วงแนวโน้ม" className="flex rounded-md border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
              {periodOptions.map((option) => (
                <button key={option.id} type="button" aria-pressed={period === option.id} onClick={() => setPeriod(option.id)} className={`min-h-8 rounded px-2.5 text-xs font-medium transition-colors ${period === option.id ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
                  {option.label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadTasks()} disabled={loading} className="rounded-md" title="โหลดข้อมูลใหม่"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /><span className="sr-only">โหลดข้อมูลใหม่</span></Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="rounded-md"><Printer className="h-4 w-4" /> พิมพ์ / PDF</Button>
            <Button size="sm" onClick={() => void exportExcel()} disabled={exporting || loading} className="rounded-md"><FileSpreadsheet className="h-4 w-4" />{exporting ? "กำลังส่งออก" : "Excel"}</Button>
          </div>}
        </header>

        {error && <div role="alert" className="mt-4 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300 print:hidden"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

        {loading ? (
          <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> กำลังโหลดรายงาน</div>
        ) : !user ? (
          <div className="my-10 rounded-lg border border-slate-200 bg-white px-5 py-12 text-center dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-medium">เข้าสู่ระบบเพื่อดูข้อมูลรายงาน</p><a href="/login" className="mt-3 inline-block text-sm font-semibold text-sky-700 hover:underline dark:text-sky-300">ไปหน้าเข้าสู่ระบบ</a></div>
        ) : !isActive ? (
          <div className="my-10 rounded-lg border border-slate-200 bg-white px-5 py-12 text-center dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-medium">ไม่สามารถยืนยันสิทธิ์การเข้าถึง Dashboard ได้</p></div>
        ) : (
          <div className="space-y-5 py-5 print:py-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 print:grid-cols-5">
              <MetricCard label="งานทั้งหมด" value={tasks.length} detail="งานที่ยังไม่อยู่ในถังขยะ" icon={<Activity className="h-4 w-4" />} color="sky" />
              <MetricCard label="เสร็จแล้ว" value={summary.counts.done} detail="สถานะปัจจุบัน" icon={<CheckCircle2 className="h-4 w-4" />} color="emerald" />
              <MetricCard label="กำลังทำ" value={summary.counts.in_progress} detail="สถานะปัจจุบัน" icon={<Clock3 className="h-4 w-4" />} color="amber" />
              <MetricCard label="งานค้าง" value={summary.counts.overdue} detail="เกินกำหนดและยังไม่เสร็จ" icon={<TriangleAlert className="h-4 w-4" />} color="rose" />
              <MetricCard label="อัตราความสำเร็จ" value={`${successRate}%`} detail="เสร็จแล้ว / งานทั้งหมด" icon={<Target className="h-4 w-4" />} color="slate" />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
              <ChartPanel title="แนวโน้มงานที่เสร็จ" subtitle={`จำนวนงานที่ปิดแล้วใน ${periodLabel.toLocaleLowerCase()}`}>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={summary.buckets} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} minTickGap={12} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="completed" name="เสร็จแล้ว" stroke="#0284c7" strokeWidth={2.5} dot={{ r: 3, fill: "#0284c7" }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartPanel>

              <ChartPanel title="สัดส่วนสถานะงาน" subtitle="ภาพรวมงานที่ยังไม่ถูกลบ">
                <div className="flex min-h-64 flex-col items-center justify-center gap-3 sm:flex-row xl:flex-col 2xl:flex-row">
                  <div className="h-48 w-full max-w-[230px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={summary.statusData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3} stroke="none">
                          {summary.statusData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid w-full grid-cols-2 gap-x-4 gap-y-2 sm:max-w-56 sm:grid-cols-1">
                    {summary.statusData.map((item) => <div key={item.name} className="flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />{item.name}</span><span className="font-semibold tabular-nums">{item.value}</span></div>)}
                  </div>
                </div>
              </ChartPanel>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
              <ChartPanel title={dashboardScope === "personal" ? "ภาระงานของฉัน" : dashboardScope === "team" ? "ภาระงานในทีม" : "ภาระงานในฝ่าย"} subtitle={`งานที่ยังดูแล และงานที่เสร็จใน ${periodLabel.toLocaleLowerCase()}`}>
                {summary.team.length ? <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.team.slice(0, 10)} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#64748b" }} interval={0} angle={-12} textAnchor="end" height={48} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                      <Tooltip />
                      <Bar dataKey="assigned" name="กำลังดูแล" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={34} />
                      <Bar dataKey="completed" name="เสร็จในช่วง" fill="#0284c7" radius={[3, 3, 0, 0]} maxBarSize={34} />
                    </BarChart>
                  </ResponsiveContainer>
                </div> : <EmptyChart message="ยังไม่มีข้อมูลงานที่มอบหมาย" />}
              </ChartPanel>

              <ChartPanel title="งานที่ควรติดตาม" subtitle="งานค้างและงานสำคัญที่ยังไม่เสร็จ">
                <div className="space-y-2">
                  {summary.highlights.map(({ task, status }) => <div key={task.id} className="flex items-start gap-2.5 rounded-md border border-slate-100 px-3 py-2.5 dark:border-slate-800 print:border-slate-300">
                    <span className={`mt-0.5 shrink-0 ${status === "overdue" ? "text-rose-600" : "text-amber-600"}`}>{status === "overdue" ? <TriangleAlert className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}</span>
                    <div className="min-w-0 flex-1"><p className="break-words text-xs font-semibold text-slate-800 dark:text-slate-100 print:text-black">{task.title}</p><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-600">{task.assignee?.full_name || "ยังไม่มอบหมาย"} · กำหนด {formatDate(task.due_date)}</p></div>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${status === "overdue" ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"}`}>{status === "overdue" ? "ค้าง" : "ด่วน"}</span>
                  </div>)}
                  {summary.highlights.length === 0 && <EmptyChart message="ไม่มีงานค้างหรืองานด่วน" />}
                </div>
              </ChartPanel>
            </div>

            <footer className="flex items-center justify-between border-t border-slate-200 pt-3 text-[11px] text-slate-400 dark:border-slate-800 print:border-slate-300 print:text-slate-600">
              <span>ข้อมูลสถานะ ณ ปัจจุบัน · แนวโน้มย้อนหลัง {periodLabel}</span>
              <span>สร้างรายงาน {new Date().toLocaleDateString("th-TH")}</span>
            </footer>
          </div>
        )}
      </main>
    </div>
  );
}

function MetricCard({ label, value, detail, icon, color }: {
  label: string;
  value: number | string;
  detail: string;
  icon: React.ReactNode;
  color: "sky" | "emerald" | "amber" | "rose" | "slate";
}) {
  const colorStyles = {
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };
  return <section className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border-slate-300 print:shadow-none sm:p-4">
    <div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-slate-500 dark:text-slate-400 print:text-slate-600">{label}</p><span className={`flex h-7 w-7 items-center justify-center rounded-md ${colorStyles[color]}`}>{icon}</span></div>
    <p className="mt-3 text-2xl font-bold tabular-nums text-slate-950 dark:text-white print:text-black">{value}</p>
    <p className="mt-1 text-[10px] leading-4 text-slate-400 dark:text-slate-500 print:text-slate-600">{detail}</p>
  </section>;
}

function EmptyChart({ message }: { message: string }) {
  return <div className="flex min-h-48 items-center justify-center gap-2 text-center text-xs text-slate-400"><TrendingUp className="h-4 w-4" />{message}</div>;
}