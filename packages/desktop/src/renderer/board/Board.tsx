import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useColumns, useCreateColumn } from "../hooks/useColumns";
import { useTasks, useUpdateTask } from "../hooks/useTasks";
import { useTeamMembers } from "../hooks/useTeamMembers";
import { useRealtimeSync } from "../hooks/useRealtimeSync";
import { useUiStore } from "../store/uiStore";
import { useAuth } from "../auth/AuthContext";
import Column from "./Column";
import { TaskCardOverlay } from "./TaskCard";
import TaskDetailModal from "../task/TaskDetailModal";
import type { Priority } from "@team-tracker/shared";

const PRIORITY_LABELS: Record<Priority, string> = { LOW: "Aşağı", MEDIUM: "Orta", HIGH: "Yüksək" };

export default function Board({ teamId }: { teamId: string }) {
  const { user } = useAuth();
  const {
    data: columns,
    isLoading: columnsLoading,
    isError: columnsError,
    refetch: refetchColumns,
  } = useColumns(teamId);
  const {
    data: tasks,
    isLoading: tasksLoading,
    isError: tasksError,
    refetch: refetchTasks,
  } = useTasks(teamId);
  const { data: members } = useTeamMembers(teamId);
  const updateTask = useUpdateTask(teamId);
  const createColumn = useCreateColumn(teamId);

  const openTaskId = useUiStore((s) => s.openTaskId);
  const newTaskColumnId = useUiStore((s) => s.newTaskColumnId);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [search, setSearch] = useState("");

  useRealtimeSync(teamId);

  // Require a small pointer move before a drag activates, otherwise dnd-kit's
  // default PointerSensor starts "dragging" on plain pointerdown (distance 0),
  // which swallows the click event a card needs to open its edit modal.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  if (columnsLoading || tasksLoading) {
    return <div style={{ padding: 24, color: "var(--muted)" }}>Yüklənir...</div>;
  }

  if (columnsError || tasksError) {
    return (
      <div style={{ padding: 24 }}>
        <div className="form-error" style={{ display: "inline-block" }}>
          Lövhəni yükləmək alınmadı. Backend işləyirmi?
        </div>
        <div style={{ marginTop: 12 }}>
          <button
            className="btn-secondary"
            style={{ width: "auto" }}
            onClick={() => {
              refetchColumns();
              refetchTasks();
            }}
          >
            Yenidən cəhd et
          </button>
        </div>
      </div>
    );
  }

  const membersById = new Map((members ?? []).map((m) => [m.id, m]));

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = String(active.id);
    const targetColumnId = String(over.id);
    const task = tasks?.find((t) => t.id === taskId);
    if (!task || task.columnId === targetColumnId) return;

    updateTask.mutate({ taskId, input: { columnId: targetColumnId } });
  }

  const takeColumn = (columns ?? []).find((c) => c.name === "Take");

  // "Götür" claims a To Do task for yourself in one step: self-assign +
  // move to the Take column, instead of a plain drag which only moves it.
  function handleTake(taskId: string) {
    if (!takeColumn || !user) return;
    updateTask.mutate({ taskId, input: { columnId: takeColumn.id, assigneeId: user.id } });
  }

  async function handleAddColumn() {
    const name = newColumnName.trim();
    if (!name) return;
    const lastColumn = (columns ?? [])[(columns ?? []).length - 1];
    await createColumn.mutateAsync({ name, afterColumnId: lastColumn?.id ?? null });
    setNewColumnName("");
    setAddingColumn(false);
  }

  const openTask = openTaskId ? tasks?.find((t) => t.id === openTaskId) : undefined;
  const modalOpen = Boolean(openTaskId) || Boolean(newTaskColumnId);
  const activeTask = activeId ? tasks?.find((t) => t.id === activeId) : undefined;

  const query = search.trim().toLowerCase();
  const visibleTasks = query
    ? (tasks ?? []).filter((t) => {
        const assigneeName = t.assigneeId ? membersById.get(t.assigneeId)?.displayName ?? "" : "";
        const priorityLabel = PRIORITY_LABELS[t.priority];
        return (
          t.title.toLowerCase().includes(query) ||
          assigneeName.toLowerCase().includes(query) ||
          priorityLabel.toLowerCase().includes(query)
        );
      })
    : tasks ?? [];

  return (
    <div style={{ padding: 20, height: "calc(100vh - 57px)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 14, flexShrink: 0 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tapşırıq, təyin olunan şəxs və ya prioritet axtar..."
          style={{
            width: 320,
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--card)",
            fontSize: 13,
            color: "var(--ink)",
          }}
        />
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="thin-scroll" style={{ display: "flex", gap: 16, height: "100%", overflowX: "auto" }}>
          {(columns ?? []).map((column, index) => (
            <Column
              key={column.id}
              column={column}
              tasks={visibleTasks.filter((t) => t.columnId === column.id)}
              membersById={membersById}
              onTake={column.name === "To Do" && takeColumn ? handleTake : undefined}
              canAddTask={index === 0}
            />
          ))}

          {user?.role === "ADMIN" && (
            <div style={{ width: 220, flexShrink: 0 }}>
              {addingColumn ? (
                <div
                  style={{
                    background: "var(--paper-panel)",
                    borderRadius: 12,
                    padding: 10,
                  }}
                >
                  <input
                    autoFocus
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddColumn();
                      if (e.key === "Escape") {
                        setAddingColumn(false);
                        setNewColumnName("");
                      }
                    }}
                    placeholder="Sütun adı"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      background: "var(--card)",
                      fontSize: 13,
                      color: "var(--ink)",
                      marginBottom: 8,
                    }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn-primary"
                      style={{ padding: "6px 12px", fontSize: 12 }}
                      disabled={!newColumnName.trim() || createColumn.isPending}
                      onClick={handleAddColumn}
                    >
                      Əlavə et
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}
                      onClick={() => {
                        setAddingColumn(false);
                        setNewColumnName("");
                      }}
                    >
                      İmtina
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingColumn(true)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--muted)",
                    fontSize: 13,
                    fontWeight: 600,
                    textAlign: "left",
                    cursor: "pointer",
                    padding: "10px 8px",
                  }}
                >
                  + Sütun əlavə et
                </button>
              )}
            </div>
          )}
        </div>

        <DragOverlay>
          {activeTask && (
            <TaskCardOverlay
              task={activeTask}
              assignee={activeTask.assigneeId ? membersById.get(activeTask.assigneeId) : undefined}
            />
          )}
        </DragOverlay>
      </DndContext>
      </div>

      {modalOpen && (
        <TaskDetailModal
          teamId={teamId}
          task={openTask}
          newTaskColumnId={newTaskColumnId}
          members={members ?? []}
          allTasks={tasks ?? []}
        />
      )}
    </div>
  );
}
