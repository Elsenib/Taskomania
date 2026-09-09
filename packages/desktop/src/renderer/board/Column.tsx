import { useDroppable } from "@dnd-kit/core";
import type { Column as ColumnType, Task, User } from "@team-tracker/shared";
import TaskCard from "./TaskCard";
import { useUiStore } from "../store/uiStore";

interface Props {
  column: ColumnType;
  tasks: Task[];
  membersById: Map<string, User>;
  onTake?: (taskId: string) => void;
  canAddTask?: boolean;
}

export default function Column({ column, tasks, membersById, onTake, canAddTask }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const openNewTask = useUiStore((s) => s.openNewTask);

  return (
    <div
      ref={setNodeRef}
      style={{
        width: 272,
        flexShrink: 0,
        background: isOver ? "var(--accent-paper)" : "var(--paper-panel)",
        borderRadius: 12,
        padding: "12px 12px 8px",
        display: "flex",
        flexDirection: "column",
        maxHeight: "100%",
        transition: "background 120ms",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          paddingBottom: 9,
          marginBottom: 10,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{column.name}</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{tasks.length}</span>
      </div>

      <div className="thin-scroll" style={{ overflowY: "auto", flex: 1, minHeight: 40 }}>
        {tasks.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--muted)", padding: "6px 2px" }}>Tapşırıq yoxdur</div>
        )}
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            assignee={task.assigneeId ? membersById.get(task.assigneeId) : undefined}
            onTake={onTake ? () => onTake(task.id) : undefined}
          />
        ))}
      </div>

      {canAddTask && (
        <button
          onClick={() => openNewTask(column.id)}
          style={{
            marginTop: 6,
            border: "none",
            background: "transparent",
            color: "var(--accent)",
            fontSize: 13,
            fontWeight: 600,
            textAlign: "left",
            cursor: "pointer",
            padding: "6px 2px",
          }}
        >
          + Tapşırıq əlavə et
        </button>
      )}
    </div>
  );
}
