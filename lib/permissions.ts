import type { Role, Task } from "@/types/database";

export type DashboardScope = "personal" | "team" | "department" | "organization";

export interface RolePermissions {
  dashboardScope: DashboardScope;
  canAssignTasks: boolean;
  canCreateTasks: boolean;
  canManageAllTasks: boolean;
  canManageOwnTasks: boolean;
  canTrashOwnAssignedTasks: boolean;
  canManageUsers: boolean;
}

export const rolePermissions: Record<Role, RolePermissions> = {
  member: {
    dashboardScope: "personal",
    canAssignTasks: false,
    canCreateTasks: true,
    canManageAllTasks: false,
    canManageOwnTasks: true,
    canTrashOwnAssignedTasks: false,
    canManageUsers: false,
  },
  tl: {
    dashboardScope: "team",
    canAssignTasks: true,
    canCreateTasks: true,
    canManageAllTasks: false,
    canManageOwnTasks: false,
    canTrashOwnAssignedTasks: true,
    canManageUsers: false,
  },
  gl: {
    dashboardScope: "department",
    canAssignTasks: true,
    canCreateTasks: true,
    canManageAllTasks: false,
    canManageOwnTasks: false,
    canTrashOwnAssignedTasks: true,
    canManageUsers: false,
  },
  mg: {
    dashboardScope: "department",
    canAssignTasks: false,
    canCreateTasks: false,
    canManageAllTasks: false,
    canManageOwnTasks: false,
    canTrashOwnAssignedTasks: true,
    canManageUsers: false,
  },
  admin: {
    dashboardScope: "organization",
    canAssignTasks: true,
    canCreateTasks: true,
    canManageAllTasks: true,
    canManageOwnTasks: true,
    canTrashOwnAssignedTasks: true,
    canManageUsers: true,
  },
};

export function canManageTask(role: Role | undefined, userId: string | undefined, task: Pick<Task, "creator_id" | "assignee_id">) {
  if (!role || !userId) return false;
  const permissions = rolePermissions[role];
  return permissions.canManageAllTasks ||
    (permissions.canManageOwnTasks && (task.creator_id === userId || task.assignee_id === userId));
}

export function canTrashTask(role: Role | undefined, userId: string | undefined, task: Pick<Task, "creator_id" | "assignee_id">) {
  if (!role || !userId) return false;
  const permissions = rolePermissions[role];
  return permissions.canManageAllTasks ||
    (permissions.canManageOwnTasks && (task.creator_id === userId || task.assignee_id === userId)) ||
    (permissions.canTrashOwnAssignedTasks && task.assignee_id === userId);
}
