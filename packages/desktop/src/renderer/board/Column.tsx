import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Column as ColumnType, Task, User } from "@team-tracker/shared";
import TaskCard from "./TaskCard";
import { useUiStore } from "../store/uiStore";
import { useT } from "../i18n/useT";
import type { ProjectTag } from "./projectTag";

interface ChildColumnData {
  column: ColumnType;
  tasks: Task[];
}

type TakeHandlerResolver = (task: Task, columnType: string) => (() => void) | undefined;

interface Props {
  column: ColumnType;
  tasks: Task[];
  childColumns?: ChildColumnData[];
  membersById: Map<string, User>;
  projectsById: Map<string, ProjectTag>;
  getTakeHandler?: TakeHandlerResolver;
  canAddTask?: boolean;
  canReorder?: boolean;
}

// A nested sub-lane (Testing under In Progress, Fail under Done) — its own
// drop target (id = the sub-column's id, same scheme the parent lane uses)
// but not part of the top-level column SortableContext, so it never
// participates in column drag-reorder.
function ChildColumnLane({
  data,
  membersById,
  projectsById,
  getTakeHandler,
}: {
  data: ChildColumnData;
  membersById: Map<string, User>;
  projectsById: Map<string, ProjectTag>;
  getTakeHandler?: TakeHandlerResolver;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: data.column.id });

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.3 }}>
          {data.column.name}
        </span>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{data.tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        style={{
          minHeight: 32,
          background: isOver ? "var(--accent-paper)" : "transparent",
          borderRadius: 8,
          transition: "background 120ms",
        }}
      >
        {data.tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            assignee={task.assigneeId ? membersById.get(task.assigneeId) : undefined}
            project={task.projectId ? projectsById.get(task.projectId) : undefined}
            onTake={getTakeHandler?.(task, data.column.type)}
          />
        ))}
      </div>
    </div>
  );
}

export default function Column({
  column,
  tasks,
  childColumns,
  membersById,
  projectsById,
  getTakeHandler,
  canAddTask,
  canReorder,
}: Props) {
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
  const t = useT();

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

      <div className="thin-scroll" style={{ overflowY: "auto", flex: 1, minHeight: 40 }}>
        <div
          ref={setDropRef}
          style={{
            minHeight: 40,
            background: isOver ? "var(--accent-paper)" : "transparent",
            borderRadius: 8,
            transition: "background 120ms",
          }}
        >
          {tasks.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--muted)", padding: "6px 2px" }}>{t("board.noTasks")}</div>
          )}
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              assignee={task.assigneeId ? membersById.get(task.assigneeId) : undefined}
              project={task.projectId ? projectsById.get(task.projectId) : undefined}
              onTake={getTakeHandler?.(task, column.type)}
            />
          ))}
        </div>

        {childColumns?.map((child) => (
          <ChildColumnLane
            key={child.column.id}
            data={child}
            membersById={membersById}
            projectsById={projectsById}
            getTakeHandler={getTakeHandler}
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
          {t("board.addTask")}
        </button>
      )}
    </div>
  );
}
