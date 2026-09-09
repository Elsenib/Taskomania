import { useEffect, useState, type CSSProperties } from "react";
import type { Priority, Task, User } from "@team-tracker/shared";
import { useUiStore } from "../store/uiStore";
import { useCreateTask, useDeleteTask, useUpdateTask } from "../hooks/useTasks";
import { ApiError } from "../api/client";
import CommentThread from "./CommentThread";
import AttachmentPanel from "./AttachmentPanel";
import DependencyPanel from "./DependencyPanel";

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
  const closeModal = useUiStore((s) => s.closeModal);
  const createTask = useCreateTask(teamId);
  const updateTask = useUpdateTask(teamId);
  const deleteTask = useDeleteTask(teamId);

  const isNew = !task;

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "MEDIUM");
  const [dueDate, setDueDate] = useState(toDateInputValue(task?.dueDate ?? null));
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setPriority(task?.priority ?? "MEDIUM");
    setDueDate(toDateInputValue(task?.dueDate ?? null));
    setAssigneeId(task?.assigneeId ?? "");
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
          assigneeId: assigneeId || undefined,
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
            assigneeId: assigneeId || null,
          },
        });
        // stay open after editing an existing task so comments remain reachable
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Yadda saxlamaq alınmadı");
    }
  }

  async function handleDelete() {
    if (!task) return;
    setError(null);
    try {
      await deleteTask.mutateAsync(task.id);
      closeModal();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Silmək alınmadı");
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
          {isNew ? "Yeni tapşırıq" : "Tapşırığı redaktə et"}
        </h3>

        {error && <div className="form-error">{error}</div>}

        <div className="field">
          <label>Başlıq</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus style={inputStyle} />
        </div>

        <div className="field">
          <label>Təsvir</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{ ...inputStyle, fontFamily: "var(--font-sans)", resize: "vertical" }}
          />
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Prioritet</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} style={inputStyle}>
              <option value="LOW">Aşağı</option>
              <option value="MEDIUM">Orta</option>
              <option value="HIGH">Yüksək</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Son tarix</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div className="field">
          <label>Təyin edilib</label>
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={inputStyle}>
            <option value="">— Kimsə təyin edilməyib —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button className="btn-primary" disabled={saving || !title.trim()} onClick={handleSave}>
            {saving ? "Saxlanılır..." : "Saxla"}
          </button>
          {!isNew && (
            <button
              className="btn-secondary"
              style={{ width: "auto", color: "var(--priority-high-ink)" }}
              onClick={handleDelete}
              disabled={deleteTask.isPending}
            >
              Sil
            </button>
          )}
          <button className="btn-secondary" style={{ width: "auto" }} onClick={closeModal}>
            Bağla
          </button>
        </div>

        {!isNew && <DependencyPanel task={task} allTasks={allTasks} />}
        {!isNew && <AttachmentPanel taskId={task.id} members={members} />}
        {!isNew && <CommentThread taskId={task.id} members={members} />}
      </div>
    </div>
  );
}
