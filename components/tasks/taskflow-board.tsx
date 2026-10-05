"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  CalendarDays,
  Check,
  GripVertical,
  LoaderCircle,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { canManageTask, canTrashTask, rolePermissions } from "@/lib/permissions";
import { Category, Profile, Task, TaskPriority, TaskStatus, Team } from "@/types/database";

type BoardTask = Task & {
  assignee?: Pick<Profile, "id" | "full_name"> | null;
  category?: Pick<Category, "id" | "name" | "color"> | null;
};

type BoardMode = "board" | "trash";

const columns: { id: TaskStatus; title: string; color: string }[] = [
  { id: "todo", title: "รอทำ", color: "border-sky-500" },
  { id: "in_progress", title: "กำลังทำ", color: "border-amber-500" },
  { id: "done", title: "เสร็จแล้ว", color: "border-emerald-500" },
  { id: "overdue", title: "งานค้าง", color: "border-rose-500" },
];

const priorityLabels: Record<TaskPriority, string> = { low: "ต่ำ", medium: "กลาง", high: "สูง" };

function localDateString() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function taskStatus(task: BoardTask): TaskStatus {
  if (task.status !== "done" && task.due_date && task.due_date < localDateString()) return "overdue";
  return task.status;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${date}T00:00:00`)
  );
}

function TaskCard({ task, canEdit, canOpen, canTrash, onEdit, onTrash }: {
  task: BoardTask;
  canEdit: boolean;
  canOpen: boolean;
  canTrash: boolean;
  onEdit: () => void;
  onTrash: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled: !canEdit });
  const status = taskStatus(task);
  return (
    <article id={`task-${task.id}`} ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} className={`rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${isDragging ? "z-10 opacity-50" : ""}`}>
      <div className="flex items-start gap-2">
        {canEdit && <button type="button" aria-label="ลากเพื่อเปลี่ยนสถานะ" className="mt-0.5 cursor-grab touch-none text-slate-400 active:cursor-grabbing" {...attributes} {...listeners}><GripVertical className="h-4 w-4" /></button>}
        <button type="button" disabled={!canOpen} onClick={onEdit} className="min-w-0 flex-1 text-left disabled:cursor-default">
          <h3 className="break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{task.title}</h3>
          {task.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{task.description}</p>}
        </button>
        {canTrash && <button type="button" aria-label="ย้ายงานไปถังขยะ" title="ย้ายงานไปถังขยะ" onClick={onTrash} className="mt-0.5 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${task.priority === "high" ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" : task.priority === "medium" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{priorityLabels[task.priority]}</span>
        {task.category && <span className="max-w-full truncate rounded px-2 py-0.5 text-[11px]" style={{ color: task.category.color, backgroundColor: `${task.category.color}18` }}>{task.category.name}</span>}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[10px] font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">{task.assignee?.full_name?.slice(0, 1) || "?"}</span>
          <span className="truncate">{task.assignee?.full_name || "ยังไม่มอบหมาย"}</span>
        </span>
        {task.due_date && <span className={`flex shrink-0 items-center gap-1 text-[11px] ${status === "overdue" ? "font-medium text-rose-600 dark:text-rose-400" : "text-slate-400"}`}><CalendarDays className="h-3.5 w-3.5" />{formatDate(task.due_date)}</span>}
      </div>
    </article>
  );
}

function TaskColumn({ column, tasks, canEditTask, canOpenTask, canTrashTask, onEdit, onTrash }: {
  column: (typeof columns)[number];
  tasks: BoardTask[];
  canEditTask: (task: BoardTask) => boolean;
  canOpenTask: (task: BoardTask) => boolean;
  canTrashTask: (task: BoardTask) => boolean;
  onEdit: (task: BoardTask) => void;
  onTrash: (task: BoardTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <section ref={setNodeRef} className={`min-h-60 rounded-lg border-t-[3px] bg-slate-100/70 p-3 transition-colors dark:bg-slate-900/60 ${column.color} ${isOver ? "bg-sky-50 dark:bg-sky-950/30" : ""}`}>
      <header className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{column.title}</h2><span className="min-w-6 rounded bg-white px-1.5 py-0.5 text-center text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">{tasks.length}</span></header>
      <div className="space-y-2.5">
        {tasks.map((task) => <TaskCard key={task.id} task={task} canEdit={canEditTask(task)} canOpen={canOpenTask(task)} canTrash={canTrashTask(task)} onEdit={() => onEdit(task)} onTrash={() => onTrash(task)} />)}
        {tasks.length === 0 && <p className="rounded-md border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400 dark:border-slate-700">ไม่มีงานในสถานะนี้</p>}
      </div>
    </section>
  );
}

export function TaskFlowBoard({ mode = "board" }: { mode?: BoardMode }) {
  const { user, profile, isLoading: authLoading, isAdmin, isLeader, isActive } = useAuth();
  const [supabase] = useState(() => createClient());
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [profiles, setProfiles] = useState<Pick<Profile, "id" | "full_name">[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editorTask, setEditorTask] = useState<BoardTask | null | undefined>(undefined);
  const notificationTaskHandled = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const isTrash = mode === "trash";
  const role = profile?.role;

  const loadData = useCallback(async () => {
    setError("");
    try {
      const taskQuery = supabase.from("tasks").select("*, assignee:profiles!tasks_assignee_id_fkey(id, full_name), category:categories(id, name, color)").eq("is_deleted", isTrash).order("created_at", { ascending: false });
      if (user && role === "member") taskQuery.or(`assignee_id.eq.${user.id},creator_id.eq.${user.id}`);
      const [taskResult, categoryResult] = await Promise.all([
        taskQuery,
        supabase.from("categories").select("*").order("name"),
      ]);
      if (taskResult.error) throw taskResult.error;
      if (categoryResult.error) throw categoryResult.error;
      const loadedTasks = (taskResult.data || []) as unknown as BoardTask[];
      const newlyOverdueIds = isTrash || !isAdmin
        ? []
        : loadedTasks
            .filter((task) => task.status !== "done" && task.status !== "overdue" && task.due_date && task.due_date < localDateString())
            .map((task) => task.id);
      if (newlyOverdueIds.length > 0) {
        const { error: overdueError } = await supabase.from("tasks").update({ status: "overdue" }).in("id", newlyOverdueIds);
        if (overdueError) console.error("Could not persist overdue task status:", overdueError);
      }
      setTasks(loadedTasks.map((task) => newlyOverdueIds.includes(task.id) ? { ...task, status: "overdue" } : task));
      setCategories((categoryResult.data || []) as Category[]);

      if (isLeader) {
        const [profileResult, teamResult] = await Promise.all([
          supabase.from("profiles").select("id, full_name, team_id, role").eq("status", "active").order("full_name"),
          !isAdmin && (role === "gl" || role === "mg")
            ? supabase.from("teams").select("id, parent_team_id")
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (profileResult.error) throw profileResult.error;
        if (teamResult.error) throw teamResult.error;

        const teamIds = new Set<string>();
        if (isAdmin) {
          setProfiles((profileResult.data || []) as Pick<Profile, "id" | "full_name">[]);
        } else if (profile?.team_id) {
          teamIds.add(profile.team_id);
          if (role === "gl" || role === "mg") {
            const teams = (teamResult.data || []) as Pick<Team, "id" | "parent_team_id">[];
            let addedTeams = true;
            while (addedTeams) {
              addedTeams = false;
              for (const team of teams) {
                if (team.parent_team_id && teamIds.has(team.parent_team_id) && !teamIds.has(team.id)) {
                  teamIds.add(team.id);
                  addedTeams = true;
                }
              }
            }
          }
          setProfiles(
            (profileResult.data || [])
              .filter((member) => {
                if (member.id === user?.id || member.team_id === null || !teamIds.has(member.team_id)) return false;
                if (role === "tl") return member.role === "member" && member.team_id === profile.team_id;
                if (role === "gl") return member.role === "member" || member.role === "tl";
                return false;
              })
              .map(({ id, full_name }) => ({ id, full_name }))
          );
        } else {
          setProfiles([]);
        }
      } else {
        setProfiles([]);
      }
    } catch (loadError) {
      console.error("Could not load task board:", loadError);
      setError("โหลดข้อมูลงานไม่สำเร็จ โปรดลองอีกครั้ง");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isLeader, isTrash, profile, role, supabase, user]);

  useEffect(() => {
    async function initializeBoard() {
      await Promise.resolve();
      if (authLoading) return;
      if (user && isActive) await loadData();
      else setLoading(false);
    }
    void initializeBoard();
  }, [authLoading, isActive, loadData, user]);

  useEffect(() => {
    if (loading || isTrash || notificationTaskHandled.current) return;
    notificationTaskHandled.current = true;

    const taskId = new URLSearchParams(window.location.search).get("task");
    if (!taskId || !tasks.some((task) => task.id === taskId)) return;

    document.getElementById(`task-${taskId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [isTrash, loading, tasks]);

  const canEditTask = useCallback(
  (task: BoardTask) => {
    if (!isActive || !user) return false;

    // 1. ถ้าเป็น Admin หรือ GL สามารถย้ายได้ทุกงาน
    if (role === "admin" || role === "gl" || role === "Admin" || role === "GL") {
      return true;
    }

    // 2. ถ้าเป็นคนสร้างงาน หรือ เป็นผู้รับผิดชอบงานนั้นๆ (ทั้ง Member, TL สามารถย้ายงานตัวเองได้)
    const isOwnerOrAssignee = task.creator_id === user.id || task.assignee_id === user.id;

    // 3. ถ้าเป็น Member ย้ายได้เฉพาะงานที่ตนเองสร้างหรือได้รับมอบหมายเท่านั้น
    if (role === "member" || role === "Member") {
      return isOwnerOrAssignee;
    }

    // 4. ถ้าเป็น TL ย้ายงานของตัวเองได้ หรือ ย้ายงานของลูกทีมในรายชื่อ profiles ที่ TL ดูแลอยู่ได้
    if (role === "tl" || role === "TL") {
      const isTeamMemberTask = profiles.some((member) => member.id === task.assignee_id);
      return isOwnerOrAssignee || isTeamMemberTask;
    }

    return false;
  },
  [isActive, role, user, profiles]
);
  const canTrashTaskForUser = useCallback(
    (task: BoardTask) => isActive && canTrashTask(role, user?.id, task),
    [isActive, role, user?.id]
  );
  const canOpenTask = useCallback(
    (task: BoardTask) => canEditTask(task) || (isActive && (role === "tl" || role === "gl")),
    [canEditTask, isActive, role]
  );
  const filteredTasks = tasks.filter((task) => {
    const matchesQuery = `${task.title} ${task.description || ""} ${task.assignee?.full_name || ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
    return matchesQuery && (priorityFilter === "all" || task.priority === priorityFilter) && (categoryFilter === "all" || task.category_id === categoryFilter);
  });

  async function moveTask(taskId: string, status: TaskStatus) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || !canEditTask(task) || task.status === status) return;
    const completedDate = status === "done" ? localDateString() : null;
    setTasks((current) => current.map((item) => item.id === taskId ? { ...item, status, completed_date: completedDate } : item));
    const { error: updateError } = await supabase.from("tasks").update({ status, completed_date: completedDate }).eq("id", taskId);
    if (updateError) {
      setError("เปลี่ยนสถานะงานไม่สำเร็จ ข้อมูลถูกโหลดกลับแล้ว");
      await loadData();
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id);
    const targetStatus = event.over?.id;
    if (typeof targetStatus === "string" && columns.some((column) => column.id === targetStatus)) await moveTask(taskId, targetStatus as TaskStatus);
  }

  async function saveTask(formData: FormData) {
    if (!user || !isActive) return;
    setSaving(true);
    setError("");
    const title = String(formData.get("title") || "").trim();
    if (!title) {
      setError("กรุณาระบุชื่องาน");
      setSaving(false);
      return;
    }
    const values = {
      title,
      description: String(formData.get("description") || "").trim() || null,
      assignee_id: editorTask && !isAdmin
        ? editorTask.assignee_id
        : isLeader ? String(formData.get("assignee_id") || "") || null : user.id,
      category_id: String(formData.get("category_id") || "") || null,
      priority: String(formData.get("priority") || "medium") as TaskPriority,
      due_date: String(formData.get("due_date") || "") || null,
      notes: String(formData.get("notes") || "").trim() || null,
    };
    const result = editorTask
      ? isLeader && !isAdmin
        ? await supabase.from("tasks").update({ assignee_id: String(formData.get("assignee_id") || "") || null }).eq("id", editorTask.id)
        : await supabase.from("tasks").update(values).eq("id", editorTask.id)
      : await supabase.from("tasks").insert({ ...values, creator_id: user.id, status: "todo" });
    if (result.error) {
      console.error("Could not save task:", result.error);
      setError("บันทึกงานไม่สำเร็จ โปรดลองอีกครั้ง");
      setSaving(false);
      return;
    }
    setEditorTask(undefined);
    setSaving(false);
    await loadData();
  }

  async function softDeleteTask(task: BoardTask) {
    if (!canEditTask(task)) return;
    const { error: deleteError } = await supabase.from("tasks").update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq("id", task.id);
    if (deleteError) setError("ย้ายงานไปถังขยะไม่สำเร็จ");
    else {
      setEditorTask(undefined);
      await loadData();
    }
  }

  async function restoreTask(task: BoardTask) {
    if (!canTrashTaskForUser(task)) return;
    const { error: restoreError } = await supabase.from("tasks").update({ is_deleted: false, deleted_at: null }).eq("id", task.id);
    if (restoreError) setError("กู้คืนงานไม่สำเร็จ");
    else await loadData();
  }

  const overdueCount = tasks.filter((task) => taskStatus(task) === "overdue").length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />
      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
          <div><p className="text-xs font-semibold uppercase text-sky-700 dark:text-sky-300">TASKFLOW / {isTrash ? "RECOVERY" : "WORKSPACE"}</p><h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">{isTrash ? "ถังขยะ" : "กระดานงาน"}</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{isTrash ? "งานที่ลบไว้และยังสามารถกู้คืนได้" : `${tasks.length} งาน · ${overdueCount} งานค้าง`}</p></div>
          {!isTrash && isActive && role && rolePermissions[role].canCreateTasks && <Button onClick={() => setEditorTask(null)} className="rounded-md"><Plus className="h-4 w-4" /> เพิ่มงาน</Button>}
        </div>
        {error && <div role="alert" className="mt-4 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"><AlertCircle className="h-4 w-4 shrink-0" />{error}<button type="button" className="ml-auto" aria-label="ปิดข้อความ" onClick={() => setError("")}><X className="h-4 w-4" /></button></div>}
        {!isTrash && <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 py-4 dark:border-slate-800">
          <label className="relative min-w-48 flex-1 sm:max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input aria-label="ค้นหางาน" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่องานหรือผู้รับผิดชอบ" className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-900" /></label>
          <select aria-label="กรองตามความสำคัญ" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="all">ทุกระดับความสำคัญ</option><option value="high">สูง</option><option value="medium">กลาง</option><option value="low">ต่ำ</option></select>
          <select aria-label="กรองตามหมวดหมู่" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="all">ทุกหมวดหมู่</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        </div>}
        {loading ? <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> กำลังโหลดงาน</div> : !isActive ? <div className="my-10 rounded-lg border border-slate-200 bg-white px-5 py-12 text-center dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-medium">{user ? "บัญชีนี้ยังไม่ได้รับอนุมัติหรือเปิดใช้งาน" : "เข้าสู่ระบบเพื่อดูและสร้างงาน"}</p><Link href={!user ? "/login" : profile?.status === "pending" ? "/pending-approval" : "/inactive"} className="mt-3 inline-block text-sm font-semibold text-sky-700 hover:underline dark:text-sky-300">{user ? "ตรวจสอบสถานะบัญชี" : "ไปหน้าเข้าสู่ระบบ"}</Link></div> : isTrash ? <div className="mt-5 space-y-2">
          {filteredTasks.map((task) => <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"><div className="min-w-0"><p className="truncate text-sm font-semibold">{task.title}</p><p className="mt-1 text-xs text-slate-500">ลบเมื่อ {task.deleted_at ? formatDate(task.deleted_at.slice(0, 10)) : "ไม่ทราบวันที่"}</p></div>{canTrashTaskForUser(task) && <Button variant="outline" size="sm" onClick={() => restoreTask(task)} className="rounded-md"><RotateCcw className="h-4 w-4" /> กู้คืน</Button>}</div>)}
          {filteredTasks.length === 0 && <p className="py-16 text-center text-sm text-slate-500">ไม่มีงานในถังขยะ</p>}
        </div> : <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}><div className="grid grid-cols-1 gap-3 py-5 sm:grid-cols-2 xl:grid-cols-4">{columns.map((column) => <TaskColumn key={column.id} column={column} tasks={filteredTasks.filter((task) => taskStatus(task) === column.id)} canEditTask={canEditTask} canOpenTask={canOpenTask} canTrashTask={canTrashTaskForUser} onEdit={setEditorTask} onTrash={(task) => void softDeleteTask(task)} />)}</div></DndContext>}
      </main>
      {editorTask !== undefined && !isTrash && isActive && <TaskEditor task={editorTask} categories={categories} profiles={profiles} allowAssignment={isLeader} assignmentOnly={Boolean(editorTask && isLeader && !isAdmin)} saving={saving} onClose={() => setEditorTask(undefined)} onSave={saveTask} onDelete={editorTask && canTrashTaskForUser(editorTask) ? () => softDeleteTask(editorTask) : undefined} />}
    </div>
  );
}

function TaskEditor({ task, categories, profiles, allowAssignment, assignmentOnly, saving, onClose, onSave, onDelete }: {
  task: BoardTask | null;
  categories: Category[];
  profiles: Pick<Profile, "id" | "full_name">[];
  allowAssignment: boolean;
  assignmentOnly: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="task-editor-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800"><h2 id="task-editor-title" className="text-lg font-semibold">{assignmentOnly ? "มอบหมายงาน" : task ? "แก้ไขงาน" : "สร้างงานใหม่"}</h2><button type="button" aria-label="ปิด" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button></header>
      <form action={onSave} className="space-y-4 p-5">
        {assignmentOnly ? (
          <>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{task?.title}</p>
            <label className="block space-y-1.5 text-sm font-medium">ผู้รับผิดชอบ<select name="assignee_id" defaultValue={task?.assignee_id && profiles.some((member) => member.id === task.assignee_id) ? task.assignee_id : ""} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-950"><option value="">ยังไม่มอบหมาย</option>{profiles.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}</select></label>
          </>
        ) : (
          <>
        <Input name="title" label="ชื่องาน" defaultValue={task?.title || ""} placeholder="ระบุชื่องาน" required maxLength={160} />
        <label className="block space-y-1.5 text-sm font-medium">รายละเอียด<textarea name="description" defaultValue={task?.description || ""} rows={3} maxLength={4000} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950" /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm font-medium">ความสำคัญ<select name="priority" defaultValue={task?.priority || "medium"} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-950"><option value="low">ต่ำ</option><option value="medium">กลาง</option><option value="high">สูง</option></select></label>
          <label className="space-y-1.5 text-sm font-medium">หมวดหมู่<select name="category_id" defaultValue={task?.category_id || ""} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-950"><option value="">ไม่ระบุ</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div>
        {allowAssignment && <label className="block space-y-1.5 text-sm font-medium">ผู้รับผิดชอบ<select name="assignee_id" defaultValue={task?.assignee_id || ""} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-950"><option value="">ยังไม่มอบหมาย</option>{profiles.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}</select></label>}
        <Input name="due_date" label="กำหนดเสร็จ" type="date" defaultValue={task?.due_date || ""} />
        <label className="block space-y-1.5 text-sm font-medium">หมายเหตุ<textarea name="notes" defaultValue={task?.notes || ""} rows={2} maxLength={2000} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950" /></label>
          </>
        )}
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">{onDelete ? <Button type="button" variant="ghost" disabled={deleting} onClick={async () => { setDeleting(true); await onDelete(); setDeleting(false); }} className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"><Trash2 className="h-4 w-4" /> ย้ายไปถังขยะ</Button> : <span />}<div className="ml-auto flex gap-2"><Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button><Button type="submit" disabled={saving} className="rounded-md">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {assignmentOnly ? "บันทึกการมอบหมาย" : "บันทึกงาน"}</Button></div></footer>
      </form>
    </section>
  </div>;
}