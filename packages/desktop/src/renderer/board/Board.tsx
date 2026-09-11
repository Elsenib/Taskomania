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
import { SortableContext, arrayMove, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { useColumns, useCreateColumn, useReorderColumn } from "../hooks/useColumns";
import { useTasks, useUpdateTask } from "../hooks/useTasks";
import { useTeamMembers } from "../hooks/useTeamMembers";
import { useProjects } from "../hooks/useProjects";
import { useRealtimeSync } from "../hooks/useRealtimeSync";
import { useUiStore } from "../store/uiStore";
import { useAuth } from "../auth/AuthContext";
import Column from "./Column";
import { TaskCardOverlay } from "./TaskCard";
import TaskDetailModal from "../task/TaskDetailModal";
import SendToTestingModal from "../task/SendToTestingModal";
import { useT } from "../i18n/useT";
import { groupColor } from "../lib/color";
import { projectIcon, type ProjectTag } from "./projectTag";
import type { Task } from "@team-tracker/shared";

export default function Board({ teamId }: { teamId: string }) {
  const { user } = useAuth();
  const t = useT();
  const PRIORITY_LABELS = { LOW: t("priority.low"), MEDIUM: t("priority.medium"), HIGH: t("priority.high") };
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
  const { data: projects } = useProjects(teamId);
  const updateTask = useUpdateTask(teamId);
  const createColumn = useCreateColumn(teamId);
  const reorderColumn = useReorderColumn(teamId);

  const openTaskId = useUiStore((s) => s.openTaskId);
  const newTaskColumnId = useUiStore((s) => s.newTaskColumnId);
  const sendToTestingTaskId = useUiStore((s) => s.sendToTestingTaskId);
  const openSendToTesting = useUiStore((s) => s.openSendToTesting);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [search, setSearch] = useState("");
  // "all" | "none" (unlabeled tasks) | a project id
  const [projectFilter, setProjectFilter] = useState("all");

  useRealtimeSync(teamId);

  // Require a small pointer move before a drag activates, otherwise dnd-kit's
  // default PointerSensor starts "dragging" on plain pointerdown (distance 0),
  // which swallows the click event a card needs to open its edit modal.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  if (columnsLoading || tasksLoading) {
    return <div style={{ padding: 24, color: "var(--muted)" }}>{t("common.loading")}</div>;
  }

  if (columnsError || tasksError) {
    return (
      <div style={{ padding: 24 }}>
        <div className="form-error" style={{ display: "inline-block" }}>
          {t("board.loadError")}
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
            {t("common.retry")}
          </button>
        </div>
      </div>
    );
  }

  const membersById = new Map((members ?? []).map((m) => [m.id, m]));
  const projectsById = new Map<string, ProjectTag>(
    (projects ?? []).map((p, i) => [p.id, { name: p.name, color: groupColor(i), Icon: projectIcon(p.id) }])
  );

  // Sub-columns (Testing under In Progress, Fail under Done) render nested
  // inside their parent's card and don't take part in column drag-reorder —
  // only top-level columns (parentId null) do.
  const topLevelColumns = (columns ?? [])
    .filter((c) => !c.parentId)
    .sort((a, b) => a.order - b.order);
  const childColumnsOf = (parentId: string) =>
    (columns ?? [])
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.order - b.order);

  const takeColumn = (columns ?? []).find((c) => c.type === "TAKE");
  const testingColumn = (columns ?? []).find((c) => c.type === "TESTING");

  // True for the one transition that needs a completed-work note first: your
  // own task, currently In Progress, headed for Testing. Shared by the drag
  // handler below and a plain drop both go through SendToTestingModal instead
  // of moving straight away — no separate "send to testing" button needed.
  function needsTestingConfirmation(task: Task, targetColumnId: string): boolean {
    if (!testingColumn || targetColumnId !== testingColumn.id) return false;
    const currentColumn = (columns ?? []).find((c) => c.id === task.columnId);
    return currentColumn?.type === "IN_PROGRESS" && task.assigneeId === user?.id;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    if (active.data.current?.type === "column") {
      if (active.id === over.id) return;
      const activeColumnId = String(active.id).replace(/^col-/, "");
      const overColumnId = String(over.id).replace(/^col-/, "");
      const orderedIds = topLevelColumns.map((c) => c.id);
      const oldIndex = orderedIds.indexOf(activeColumnId);
      const newIndex = orderedIds.indexOf(overColumnId);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(orderedIds, oldIndex, newIndex);
      const newPosition = reordered.indexOf(activeColumnId);
      const afterColumnId = newPosition === 0 ? null : reordered[newPosition - 1];
      reorderColumn.mutate({ columnId: activeColumnId, afterColumnId });
      return;
    }

    const taskId = String(active.id);
    const targetColumnId = String(over.id);
    const task = tasks?.find((t) => t.id === taskId);
    if (!task || task.columnId === targetColumnId) return;

    if (needsTestingConfirmation(task, targetColumnId)) {
      openSendToTesting(taskId);
      return;
    }

    updateTask.mutate({ taskId, input: { columnId: targetColumnId } });
  }

  // "Götür" claims a task for yourself in one step, instead of a plain drag
  // which only moves it: from To Do it's a first-come claim (self-assign +
  // move); from Fail the admin has already reassigned it to you, so it just
  // moves — see getTakeHandler for which column shows the button to whom.
  function handleTakeFromTodo(taskId: string) {
    if (!takeColumn || !user) return;
    updateTask.mutate({ taskId, input: { columnId: takeColumn.id, assigneeId: user.id } });
  }

  function handleTakeFromFail(taskId: string) {
    if (!takeColumn) return;
    updateTask.mutate({ taskId, input: { columnId: takeColumn.id } });
  }

  function getTakeHandler(task: Task, columnType: string): (() => void) | undefined {
    if (!takeColumn || !user) return undefined;
    if (columnType === "TODO") return () => handleTakeFromTodo(task.id);
    if (columnType === "FAIL" && task.assigneeId === user.id) return () => handleTakeFromFail(task.id);
    return undefined;
  }

  async function handleAddColumn() {
    const name = newColumnName.trim();
    if (!name) return;
    const lastColumn = topLevelColumns[topLevelColumns.length - 1];
    await createColumn.mutateAsync({ name, afterColumnId: lastColumn?.id ?? null });
    setNewColumnName("");
    setAddingColumn(false);
  }

  const openTask = openTaskId ? tasks?.find((t) => t.id === openTaskId) : undefined;
  const modalOpen = Boolean(openTaskId) || Boolean(newTaskColumnId);
  const activeTask = activeId ? tasks?.find((t) => t.id === activeId) : undefined;

  const query = search.trim().toLowerCase();
  const bySearch = query
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
  const visibleTasks =
    projectFilter === "all"
      ? bySearch
      : projectFilter === "none"
        ? bySearch.filter((t) => !t.projectId)
        : bySearch.filter((t) => t.projectId === projectFilter);

  return (
    <div style={{ padding: 20, height: "calc(100vh - 57px)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 14, flexShrink: 0, display: "flex", gap: 10 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("board.searchPlaceholder")}
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
        {(projects ?? []).length > 0 && (
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--card)",
              fontSize: 13,
              color: "var(--ink)",
            }}
          >
            <option value="all">{t("board.allProjects")}</option>
            <option value="none">{t("task.noProject")}</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="thin-scroll" style={{ display: "flex", gap: 16, height: "100%", overflowX: "auto" }}>
          <SortableContext
            items={topLevelColumns.map((c) => `col-${c.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            {topLevelColumns.map((column, index) => (
              <Column
                key={column.id}
                column={column}
                tasks={visibleTasks.filter((t) => t.columnId === column.id)}
                childColumns={childColumnsOf(column.id).map((child) => ({
                  column: child,
                  tasks: visibleTasks.filter((t) => t.columnId === child.id),
                }))}
                membersById={membersById}
                projectsById={projectsById}
                getTakeHandler={getTakeHandler}
                canAddTask={index === 0}
                canReorder={user?.role === "ADMIN"}
              />
            ))}
          </SortableContext>

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
                    placeholder={t("board.columnNamePlaceholder")}
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
                      {t("common.add")}
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}
                      onClick={() => {
                        setAddingColumn(false);
                        setNewColumnName("");
                      }}
                    >
                      {t("common.cancel")}
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
                  {t("board.addColumn")}
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
              project={activeTask.projectId ? projectsById.get(activeTask.projectId) : undefined}
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

      {sendToTestingTaskId && testingColumn && (
        <SendToTestingModal
          teamId={teamId}
          taskId={sendToTestingTaskId}
          testingColumnId={testingColumn.id}
        />
      )}
    </div>
  );
}
