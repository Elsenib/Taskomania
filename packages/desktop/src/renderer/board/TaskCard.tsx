import { CSSProperties } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { Task, User } from "@team-tracker/shared";
import PriorityBadge from "../task/PriorityBadge";
import { useUiStore } from "../store/uiStore";
import { formatShortDate } from "../lib/formatDate";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function formatDueDate(iso: string) {
  const d = new Date(iso);
  const overdue = d.getTime() < Date.now();
  return { label: formatShortDate(iso), overdue };
}

interface CardVisualProps {
  task: Task;
  assignee: User | undefined;
  lifted?: boolean;
  onTake?: () => void;
}

// Pure presentational card markup, shared between the in-column draggable
// card and its DragOverlay clone — keeps the two visually identical.
function TaskCardVisual({ task, assignee, lifted, onTake }: CardVisualProps) {
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
      <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 9, color: "var(--ink)" }}>{task.title}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
          <PriorityBadge priority={task.priority} />
          {due && (
            <span style={{ fontSize: 11, color: due.overdue ? "var(--priority-high-ink)" : "var(--muted)" }}>
              {due.overdue ? "gecikib · " : ""}
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
              Götür
            </button>
          )}
          {assignee && (
            <div
              title={assignee.displayName}
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "var(--accent)",
                color: "white",
                fontSize: 10,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {initials(assignee.displayName)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Rendered inside <DragOverlay> — a free-floating clone, unconstrained by
// any column's overflow/stacking context, that follows the pointer.
export function TaskCardOverlay({ task, assignee }: { task: Task; assignee: User | undefined }) {
  return (
    <div style={{ cursor: "grabbing" }}>
      <TaskCardVisual task={task} assignee={assignee} lifted />
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  assignee: User | undefined;
  onTake?: () => void;
}

export default function TaskCard({ task, assignee, onTake }: TaskCardProps) {
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
      <TaskCardVisual task={task} assignee={assignee} onTake={onTake} />
    </div>
  );
}
