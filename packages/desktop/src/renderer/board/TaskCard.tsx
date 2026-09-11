import { CSSProperties } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { Task, User } from "@team-tracker/shared";
import PriorityBadge from "../task/PriorityBadge";
import Avatar from "../components/Avatar";
import { useUiStore } from "../store/uiStore";
import { formatShortDate } from "../lib/formatDate";
import { useT } from "../i18n/useT";
import type { ProjectTag } from "./projectTag";

function formatDueDate(iso: string) {
  const d = new Date(iso);
  const overdue = d.getTime() < Date.now();
  return { label: formatShortDate(iso), overdue };
}

interface CardVisualProps {
  task: Task;
  assignee: User | undefined;
  project?: ProjectTag;
  lifted?: boolean;
  onTake?: () => void;
}

// Pure presentational card markup, shared between the in-column draggable
// card and its DragOverlay clone — keeps the two visually identical.
function TaskCardVisual({ task, assignee, project, lifted, onTake }: CardVisualProps) {
  const t = useT();
  const due = task.dueDate ? formatDueDate(task.dueDate) : null;

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        boxShadow: lifted ? "0 8px 24px rgba(0,0,0,0.18)" : "0 1px 2px rgba(0,0,0,0.05)",
        padding: "10px 12px",
        width: lifted ? 248 : undefined,
      }}
    >
      {project && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
          <project.Icon size={11} color={project.color} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: project.color,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {project.name}
          </span>
        </div>
      )}
      <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 9, color: "var(--ink)" }}>{task.title}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
          <PriorityBadge priority={task.priority} />
          {due && (
            <span style={{ fontSize: 11, color: due.overdue ? "var(--priority-high-ink)" : "var(--muted)" }}>
              {due.overdue ? t("board.overduePrefix") : ""}
              {due.label}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {onTake && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTake();
              }}
              style={{
                border: "none",
                background: "var(--accent-paper)",
                color: "var(--accent)",
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 6,
                padding: "3px 8px",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {t("board.take")}
            </button>
          )}
          {assignee && <Avatar displayName={assignee.displayName} avatarUrl={assignee.avatarUrl} />}
        </div>
      </div>
    </div>
  );
}

// Rendered inside <DragOverlay> — a free-floating clone, unconstrained by
// any column's overflow/stacking context, that follows the pointer.
export function TaskCardOverlay({
  task,
  assignee,
  project,
}: {
  task: Task;
  assignee: User | undefined;
  project?: ProjectTag;
}) {
  return (
    <div style={{ cursor: "grabbing" }}>
      <TaskCardVisual task={task} assignee={assignee} project={project} lifted />
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  assignee: User | undefined;
  project?: ProjectTag;
  onTake?: () => void;
}

export default function TaskCard({ task, assignee, project, onTake }: TaskCardProps) {
  const openTask = useUiStore((s) => s.openTask);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { type: "task" },
  });

  // No self-transform here — DragOverlay renders the moving clone. This
  // element just becomes an invisible placeholder holding the slot's space
  // while dragging, so it never fights the column's own overflow/scroll.
  const style: CSSProperties = {
    marginBottom: 8,
    cursor: "grab",
    visibility: isDragging ? "hidden" : "visible",
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} onClick={() => openTask(task.id)}>
      <TaskCardVisual task={task} assignee={assignee} project={project} onTake={onTake} />
    </div>
  );
}
