import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Column as ColumnType, Task, User } from "@team-tracker/shared";
import TaskCard from "./TaskCard";
import { useUiStore } from "../store/uiStore";

interface Props {
  column: ColumnType;
  tasks: Task[];
  membersById: Map<string, User>;
  onTake?: (taskId: string) => void;
  canAddTask?: boolean;
  canReorder?: boolean;
}

export default function Column({ column, tasks, membersById, onTake, canAddTask, canReorder }: Props) {
  // Two separate dnd-kit hooks on purpose, with disjoint ids: this one is
  // the drop target for a *task* card landing in this column (id = the raw
  // column id, matched against in Board's handleDragEnd). The column-reorder
  // sortable below uses a "col-" prefixed id instead — sharing one id
  // between two droppable registrations in the same DndContext would have
  // one silently overwrite the other's registered rect.
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: column.id });

  const {
    setNodeRef: setSortRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `col-${column.id}`, data: { type: "column" }, disabled: !canReorder });

  const openNewTask = useUiStore((s) => s.openNewTask);

  return (
    <div
      ref={setSortRef}
      style={{
        width: 272,
        flexShrink: 0,
        background: "var(--paper-panel)",
        borderRadius: 12,
        padding: "12px 12px 8px",
        display: "flex",
        flexDirection: "column",
        maxHeight: "100%",
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <div
        {...attributes}
        {...listeners}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          paddingBottom: 9,
          marginBottom: 10,
          borderBottom: "1px solid var(--border)",
          cursor: canReorder ? "grab" : "default",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{column.name}</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{tasks.length}</span>
      </div>

      <div
        ref={setDropRef}
        className="thin-scroll"
        style={{
          overflowY: "auto",
          flex: 1,
          minHeight: 40,
          background: isOver ? "var(--accent-paper)" : "transparent",
          borderRadius: 8,
          transition: "background 120ms",
        }}
      >
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
