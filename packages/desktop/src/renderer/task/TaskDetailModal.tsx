import { useEffect, useState, type CSSProperties } from "react";
import type { Priority, Task, User } from "@team-tracker/shared";
import { useUiStore } from "../store/uiStore";
import { useCreateTask, useDeleteTask, useUpdateTask } from "../hooks/useTasks";
import { useColumns } from "../hooks/useColumns";
import { useProjects } from "../hooks/useProjects";
import { ApiError, getToken, API_URL } from "../api/client";
import CommentThread from "./CommentThread";
import AttachmentPanel from "./AttachmentPanel";
import DependencyPanel from "./DependencyPanel";
import TaskActivityTimeline from "./TaskActivityTimeline";
import { useT } from "../i18n/useT";
import { useAuth } from "../auth/AuthContext";

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--paper)",
  fontFamily: "var(--font-sans)",
  fontSize: 14,
  color: "var(--ink)",
};

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

interface Props {
  teamId: string;
  task: Task | undefined; // undefined => creating a new task
  newTaskColumnId: string | null;
  members: User[];
  allTasks: Task[];
}

export default function TaskDetailModal({ teamId, task, newTaskColumnId, members, allTasks }: Props) {
  const t = useT();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const closeModal = useUiStore((s) => s.closeModal);
  const createTask = useCreateTask(teamId);
  const updateTask = useUpdateTask(teamId);
  const deleteTask = useDeleteTask(teamId);
  const { data: columns } = useColumns(teamId);
  const { data: projects } = useProjects(teamId);
  const membersById = new Map(members.map((m) => [m.id, m]));

  const isNew = !task;
  const currentColumn = columns?.find((c) => c.id === task?.columnId);
  // Only the person actually doing the work sees this, and only once the
  // task has moved to In Progress — before that there's nothing to "work
  // on" yet, and it'd otherwise show on every task the admin looks at.
  const showWorkChoice = !isNew && task?.assigneeId === user?.id && currentColumn?.type === "IN_PROGRESS";

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "MEDIUM");
  const [dueDate, setDueDate] = useState(toDateInputValue(task?.dueDate ?? null));
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? "");
  const [projectId, setProjectId] = useState(task?.projectId ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setPriority(task?.priority ?? "MEDIUM");
    setDueDate(toDateInputValue(task?.dueDate ?? null));
    setAssigneeId(task?.assigneeId ?? "");
    setProjectId(task?.projectId ?? "");
  }, [task]);

  const saving = createTask.isPending || updateTask.isPending;

  async function handleSave() {
    if (!title.trim()) return;
    setError(null);
    const dueDateIso = dueDate ? new Date(dueDate + "T00:00:00").toISOString() : undefined;

    try {
      if (isNew) {
        if (!newTaskColumnId) return;
        await createTask.mutateAsync({
          columnId: newTaskColumnId,
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: dueDateIso,
          projectId: projectId || undefined,
          ...(isAdmin && { assigneeId: assigneeId || undefined }),
        });
        closeModal();
      } else {
        await updateTask.mutateAsync({
          taskId: task.id,
          input: {
            title: title.trim(),
            description: description.trim() || null,
            priority,
            dueDate: dueDateIso ?? null,
            projectId: projectId || null,
            ...(isAdmin && { assigneeId: assigneeId || null }),
          },
        });
        // stay open after editing an existing task so comments remain reachable
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.saveFailed"));
    }
  }

  async function handleDelete() {
    if (!task) return;
    setError(null);
    try {
      await deleteTask.mutateAsync(task.id);
      closeModal();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.deleteFailed"));
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.28)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={closeModal}
    >
      <div
        style={{
          background: "var(--card)",
          borderRadius: 14,
          padding: 26,
          width: 440,
          maxHeight: "85vh",
          overflowY: "auto",
          border: "1px solid var(--border)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.14)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 20px", fontWeight: 600, fontSize: 16, color: "var(--ink)" }}>
          {isNew ? t("task.newTitle") : t("task.editTitle")}
        </h3>

        {error && <div className="form-error">{error}</div>}

        <div className="field">
          <label>{t("task.titleLabel")}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus style={inputStyle} />
        </div>

        <div className="field">
          <label>{t("task.description")}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{ ...inputStyle, fontFamily: "var(--font-sans)", resize: "vertical" }}
          />
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>{t("task.priority")}</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} style={inputStyle}>
              <option value="LOW">{t("priority.low")}</option>
              <option value="MEDIUM">{t("priority.medium")}</option>
              <option value="HIGH">{t("priority.high")}</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>{t("task.dueDate")}</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div className="field">
          <label>{t("task.project")}</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={inputStyle}>
            <option value="">{t("task.noProject")}</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>{t("task.assignee")}</label>
          {isAdmin ? (
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={inputStyle}>
              <option value="">{t("task.unassigned")}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ ...inputStyle, color: "var(--muted)", background: "var(--paper-panel)" }}>
              {task?.assigneeId ? membersById.get(task.assigneeId)?.displayName ?? "—" : t("task.unassigned")}
            </div>
          )}
        </div>

        {showWorkChoice && (
          <div className="field">
            <label>{t("task.workWhereQuestion")}</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ width: "auto", padding: "6px 12px" }}
                onClick={() => {
                  const token = getToken();
                  if (token) window.teamTracker.openIdeForTask(task!.id, token, API_URL);
                }}
              >
                {t("task.workInternalIde")}
              </button>
              <button type="button" className="btn-secondary" style={{ width: "auto", padding: "6px 12px" }}>
                {t("task.workExternalTool")}
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
              {t("task.workSavedNotice")}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button className="btn-primary" disabled={saving || !title.trim()} onClick={handleSave}>
            {saving ? t("common.saving") : t("common.save")}
          </button>
          {!isNew && isAdmin && (
            <button
              className="btn-secondary"
              style={{ width: "auto", color: "var(--priority-high-ink)" }}
              onClick={handleDelete}
              disabled={deleteTask.isPending}
            >
              {t("common.delete")}
            </button>
          )}
          <button className="btn-secondary" style={{ width: "auto" }} onClick={closeModal}>
            {t("common.close")}
          </button>
        </div>

        {!isNew && <DependencyPanel task={task} allTasks={allTasks} />}
        {!isNew && <AttachmentPanel taskId={task.id} members={members} />}
        {!isNew && (
          <TaskActivityTimeline taskId={task.id} columns={columns ?? []} membersById={membersById} />
        )}
        {!isNew && <CommentThread taskId={task.id} members={members} />}
      </div>
    </div>
  );
}
