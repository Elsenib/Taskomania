import { useState } from "react";
import { useUiStore } from "../store/uiStore";
import { useCreateComment } from "../hooks/useComments";
import { useUpdateTask } from "../hooks/useTasks";
import { ApiError } from "../api/client";
import { useT } from "../i18n/useT";

interface Props {
  teamId: string;
  taskId: string;
  testingColumnId: string;
}

// Gate between "In Progress" and "Testing": a plain drag let people send
// unfinished work over by accident, which just meant the admin caught it
// later and bounced it back — wasted a round trip for both sides. Requiring
// a short note here (posted as a normal comment, so it shows up in the same
// thread the admin already reads) forces a deliberate "yes, this is done"
// moment instead.
export default function SendToTestingModal({ teamId, taskId, testingColumnId }: Props) {
  const t = useT();
  const closeModal = useUiStore((s) => s.closeModal);
  const createComment = useCreateComment(taskId);
  const updateTask = useUpdateTask(teamId);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submitting = createComment.isPending || updateTask.isPending;

  async function handleConfirm() {
    if (!note.trim()) return;
    setError(null);
    try {
      await createComment.mutateAsync(note.trim());
      await updateTask.mutateAsync({ taskId, input: { columnId: testingColumnId } });
      closeModal();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("testFlow.submitFailed"));
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
          width: 420,
          border: "1px solid var(--border)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.14)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 16, color: "var(--ink)" }}>
          {t("testFlow.title")}
        </h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)" }}>
          {t("testFlow.description")}
        </p>

        {error && <div className="form-error">{error}</div>}

        <div className="field">
          <label htmlFor="send-to-testing-note">{t("testFlow.noteLabel")}</label>
          <textarea
            id="send-to-testing-note"
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={t("testFlow.notePlaceholder")}
            style={{
              width: "100%",
              padding: "8px 10px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--paper)",
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              color: "var(--ink)",
              resize: "vertical",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            className="btn-primary"
            disabled={submitting || !note.trim()}
            onClick={handleConfirm}
          >
            {submitting ? t("testFlow.submitting") : t("testFlow.confirm")}
          </button>
          <button className="btn-secondary" style={{ width: "auto" }} onClick={closeModal}>
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
