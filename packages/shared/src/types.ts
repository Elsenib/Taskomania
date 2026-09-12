export type Role = "ADMIN" | "MENTOR" | "MEMBER";
export type Priority = "LOW" | "MEDIUM" | "HIGH";

export interface Team {
  id: string;
  name: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  onboardingSeenAt: string | null;
  // "Active team" context for this session — a user may belong to several
  // teams (see MyTeam[]/GET /auth/my-teams), this is just which one the
  // current token is scoped to.
  teamId: string;
  role: Role;
  createdAt: string;
}

// One row per team the current user belongs to, for the team switcher.
export interface MyTeam {
  teamId: string;
  teamName: string;
  role: Role;
}

export type ColumnType = "TODO" | "TAKE" | "IN_PROGRESS" | "TESTING" | "DONE" | "FAIL" | "CUSTOM";

// One team can run several concurrent projects without their tasks mixing
// in the same columns — this is just a tag on a task plus a board filter.
// No color field: the client derives a stable, well-separated color from a
// project's position in this list (see lib/color.ts groupColor), the same
// scheme already used for per-member colors in the Graph view.
export interface Project {
  id: string;
  teamId: string;
  name: string;
  createdAt: string;
}

export interface Column {
  id: string;
  teamId: string;
  name: string;
  type: ColumnType;
  order: number;
  parentId: string | null;
}

export interface Task {
  id: string;
  teamId: string;
  columnId: string;
  title: string;
  description: string | null;
  priority: Priority;
  dueDate: string | null;
  assigneeId: string | null;
  projectId: string | null;
  createdById: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  userId: string;
  fromColumnId: string | null;
  toColumnId: string;
  assigneeId: string | null;
  createdAt: string;
}

export interface MemberStats {
  userId: string;
  successCount: number;
  failCount: number;
  activeCount: number;
  percentage: number;
}

export interface TeamActivityEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  userId: string;
  assigneeId: string | null;
  fromColumnId: string | null;
  toColumnId: string;
  createdAt: string;
}

export interface MemberProfile {
  user: User;
  // null for admins — they don't execute tasks, so there's no productivity
  // percentage to show (see stats.service.ts on the server).
  stats: MemberStats | null;
  currentTasks: Task[];
  successfulTasks: Task[];
  failedTasks: Task[];
  attachments: Attachment[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type AttachmentKind = "FILE" | "ARCHIVE";

export interface Attachment {
  id: string;
  taskId: string;
  kind: AttachmentKind;
  originalName: string;
  // Random per-attachment token embedded in content-serving URLs instead of a
  // JWT header — see docs/ARCHITECTURE.md ("Kritik dizayn qərarı" section).
  accessToken: string;
  sizeBytes: number;
  uploadedById: string;
  createdAt: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  children?: FileTreeNode[];
}

export interface TaskDependency {
  id: string;
  blockingTaskId: string; // must finish first
  blockedTaskId: string; // waiting on blockingTaskId
  createdAt: string;
}

export interface GraphData {
  tasks: Task[];
  members: User[];
  attachments: Attachment[];
  dependencies: TaskDependency[];
  columns: Column[];
}

// Socket.IO event payloads (server -> client), broadcast to room `team:<teamId>`
export interface ServerToClientEvents {
  "column:created": (column: Column) => void;
  // Broadcasts the full, freshly-renumbered list rather than a single column
  // — reordering shifts every sibling's `order`, so this saves every other
  // client a "which else changed?" round trip.
  "column:reordered": (columns: Column[]) => void;
  "column:renamed": (column: Column) => void;
  "project:created": (project: Project) => void;
  "project:renamed": (project: Project) => void;
  "project:deleted": (payload: { id: string }) => void;
  "member:updated": (user: User) => void;
  "task:created": (task: Task) => void;
  "task:updated": (task: Task) => void;
  "task:deleted": (payload: { id: string }) => void;
  "comment:created": (comment: Comment) => void;
  "attachment:created": (attachment: Attachment) => void;
  "attachment:deleted": (payload: { id: string; taskId: string }) => void;
  "dependency:created": (dependency: TaskDependency) => void;
  "dependency:deleted": (payload: { id: string; blockingTaskId: string; blockedTaskId: string }) => void;
}
