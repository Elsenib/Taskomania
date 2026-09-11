import { useState } from "react";
import type { Attachment } from "@team-tracker/shared";
import { useAuth } from "../auth/AuthContext";
import { useTeamMembers } from "../hooks/useTeamMembers";
import { useTeamAttachments } from "../hooks/useAttachments";
import Avatar from "../components/Avatar";
import AttachmentPreviewModal from "../task/AttachmentPreviewModal";
import DesignCanvas from "./DesignCanvas";
import { useT } from "../i18n/useT";

// Top-level view (like the Graph) rather than the per-task "Kanvasda bax"
// modal — every member gets their own persistent canvas (all design files
// they've uploaded, across every task), and anyone on the team — admin or
// member — can browse anyone else's, no restriction (unlike profiles, which
// hide the admin's from members). First pass; more is planned here later.
export default function CanvasBrowserScreen({ teamId, onExit }: { teamId: string; onExit: () => void }) {
  const t = useT();
  const { user } = useAuth();
  const { data: members } = useTeamMembers(teamId);
  const { data: attachments } = useTeamAttachments(teamId);
  const [selectedUserId, setSelectedUserId] = useState(user?.id ?? "");
  const [previewing, setPreviewing] = useState<Attachment | null>(null);

  const myAttachments = (attachments ?? []).filter((a) => a.uploadedById === selectedUserId);

  return (
    <>
      <DesignCanvas
        attachments={myAttachments}
        onClose={onExit}
        onOpenAttachment={setPreviewing}
        extraHeaderContent={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("canvas.whoseCanvas")}</span>
            <div style={{ display: "flex", gap: 6 }}>
              {(members ?? []).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedUserId(m.id)}
                  title={m.displayName}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    border: "1px solid",
                    borderColor: m.id === selectedUserId ? "var(--accent)" : "var(--border)",
                    background: m.id === selectedUserId ? "var(--accent-paper)" : "transparent",
                    borderRadius: 20,
                    padding: "3px 10px 3px 3px",
                    cursor: "pointer",
                  }}
                >
                  <Avatar displayName={m.displayName} avatarUrl={m.avatarUrl} size={20} fontSize={9} />
                  <span style={{ fontSize: 12, color: "var(--ink)" }}>{m.displayName}</span>
                </button>
              ))}
            </div>
          </div>
        }
      />
      {previewing && <AttachmentPreviewModal attachment={previewing} onClose={() => setPreviewing(null)} />}
    </>
  );
}
