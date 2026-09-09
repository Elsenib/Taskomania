export type Role = "ADMIN" | "MEMBER";
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
  teamId: string;
  role: Role;
  createdAt: string;
}

export interface Column {
  id: string;
  teamId: string;
  name: string;
  order: number;
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
  "task:created": (task: Task) => void;
  "task:updated": (task: Task) => void;
  "task:deleted": (payload: { id: string }) => void;
  "comment:created": (comment: Comment) => void;
  "attachment:created": (attachment: Attachment) => void;
  "attachment:deleted": (payload: { id: string; taskId: string }) => void;
  "dependency:created": (dependency: TaskDependency) => void;
  "dependency:deleted": (payload: { id: string; blockingTaskId: string; blockedTaskId: string }) => void;
}
