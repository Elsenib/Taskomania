import { useState } from "react";
import type { Task } from "@team-tracker/shared";
import { useDependencies, useCreateDependency, useDeleteDependency } from "../hooks/useDependencies";
import { ApiError } from "../api/client";

export default function DependencyPanel({ task, allTasks }: { task: Task; allTasks: Task[] }) {
  const { data: dependencies, isLoading } = useDependencies(task.id);
  const createDependency = useCreateDependency(task.id);
  const deleteDependency = useDeleteDependency(task.id);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tasksById = new Map(allTasks.map((t) => [t.id, t]));
  const otherTasks = allTasks.filter((t) => t.id !== task.id);

  const blocking = (dependencies ?? []).filter((d) => d.blockingTaskId === task.id);
  const blockedBy = (dependencies ?? []).filter((d) => d.blockedTaskId === task.id);

  async function handleAdd() {
    if (!selected) return;
    setError(null);
    try {
      await createDependency.mutateAsync(selected);
      setSelected("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Əlaqə yaradıla bilmədi");
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    try {
      await deleteDependency.mutateAsync(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Silmək alınmadı");
    }
  }

  return (
    <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Asılılıqlar</div>

      {isLoading && <div style={{ fontSize: 13, color: "var(--muted)" }}>Yüklənir...</div>}
      {error && <div style={{ fontSize: 12, color: "var(--priority-high-ink)", marginBottom: 8 }}>{error}</div>}

      {!isLoading && blocking.length === 0 && blockedBy.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>Heç bir əlaqə yoxdur.</div>
      )}

      {blockedBy.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Bunlardan asılıdır:</div>
          {blockedBy.map((d) => (
            <DependencyRow
              key={d.id}
              title={tasksById.get(d.blockingTaskId)?.title ?? "(silinmiş tapşırıq)"}
              onRemove={() => handleRemove(d.id)}
            />
          ))}
        </div>
      )}

      {blocking.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Bunları bloklayır:</div>
          {blocking.map((d) => (
            <DependencyRow
              key={d.id}
              title={tasksById.get(d.blockedTaskId)?.title ?? "(silinmiş tapşırıq)"}
              onRemove={() => handleRemove(d.id)}
            />
          ))}
        </div>
      )}

      {otherTasks.length > 0 && (
        <div style={{ display: "flex", gap: 8 }}>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            style={{
              flex: 1,
              padding: "6px 8px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--paper)",
              fontSize: 13,
              color: "var(--ink)",
            }}
          >
            <option value="">— tapşırıq seç —</option>
            {otherTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!selected || createDependency.isPending}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--accent)",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              opacity: !selected || createDependency.isPending ? 0.5 : 1,
            }}
          >
            Blokla
          </button>
        </div>
      )}
    </div>
  );
}

function DependencyRow({ title, onRemove }: { title: string; onRemove: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
      <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{title}</span>
      <button
        type="button"
        onClick={onRemove}
        style={{ border: "none", background: "transparent", color: "var(--priority-high-ink)", fontSize: 12, cursor: "pointer" }}
      >
        Sil
      </button>
    </div>
  );
}
