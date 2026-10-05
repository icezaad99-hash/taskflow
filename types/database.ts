export type Role = "member" | "tl" | "gl" | "mg" | "admin";

export type AccountStatus = "pending" | "active" | "inactive";

export type TaskPriority = "low" | "medium" | "high";

export type TaskStatus = "todo" | "in_progress" | "done" | "overdue";

export type NotificationType =
  | "task_assigned"
  | "task_comment"
  | "task_status_changed"
  | "task_overdue"
  | "system";

export interface Team {
  id: string;
  name: string;
  parent_team_id: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  team_id: string | null;
  status: AccountStatus;
  avatar_url: string | null;
  locale: "th" | "en";
  created_at: string;
  updated_at?: string;
  team?: Team | null;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  creator_id: string | null;
  category_id: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  completed_date: string | null;
  notes: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  assignee?: Profile | null;
  creator?: Profile | null;
  category?: Category | null;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: Profile | null;
}

export interface Attachment {
  id: string;
  task_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  created_at: string;
  user?: Profile | null;
}

export interface Notification {
  id: string;
  user_id: string;
  task_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  task?: Task | null;
}
