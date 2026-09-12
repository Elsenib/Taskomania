import { useState } from "react";
import type { Attachment, Task } from "@team-tracker/shared";
import { useMemberProfile, useTeamStats } from "../hooks/useProfile";
import { useTeamMembers, useSetMemberRole } from "../hooks/useTeamMembers";
import { roleLabel } from "../lib/roleLabel";
import Avatar from "../components/Avatar";
import AvatarLightbox from "../components/AvatarLightbox";
import PriorityBadge from "../task/PriorityBadge";
import AttachmentPreviewModal from "../task/AttachmentPreviewModal";
import { formatBytes } from "../lib/formatBytes";
import { useUiStore } from "../store/uiStore";
import { useT } from "../i18n/useT";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import OnboardingModal from "../components/OnboardingModal";

interface Props {
  teamId: string;
  userId: string;
  onClose: () => void;
}

function TaskRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--border)",
        padding: "7px 0",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span style={{ fontSize: 13, color: "var(--ink)" }}>{task.title}</span>
      <PriorityBadge priority={task.priority} />
    </button>
  );
}

// A full top-level view (like Board/Graph/Canvas), not an overlay modal —
// so navigating into someone's profile feels like going to its own screen,
// with a normal back button, rather than a popup on top of the board.
export default function ProfileScreen({ teamId, userId, onClose }: Props) {
  const t = useT();
  const { user: viewer } = useAuth();
  const { data: profile, isLoading, error } = useMemberProfile(teamId, userId);
  const { data: teamStats } = useTeamStats(teamId);
  const { data: members } = useTeamMembers(teamId);
  const openTask = useUiStore((s) => s.openTask);
  const [previewing, setPreviewing] = useState<Attachment | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [avatarEnlarged, setAvatarEnlarged] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const isOwnProfile = viewer?.id === userId;
  const setMemberRole = useSetMemberRole(teamId);

  const membersById = new Map((members ?? []).map((m) => [m.id, m]));
  const ranked = [...(teamStats ?? [])].sort((a, b) => b.percentage - a.percentage);

  // Admin promoting/demoting someone else — never the admin's own role, and
  // never another admin's (setMemberRole rejects that server-side too; this
  // just keeps the button from appearing where it'd only ever 400).
  const canManageRole = viewer?.role === "ADMIN" && !isOwnProfile;

  async function handleToggleRole(currentRole: "MENTOR" | "MEMBER") {
    setRoleError(null);
    try {
      await setMemberRole.mutateAsync({ userId, role: currentRole === "MENTOR" ? "MEMBER" : "MENTOR" });
    } catch (err) {
      setRoleError(err instanceof ApiError ? err.message : t("common.roleChangeFailed"));
    }
  }

  return (
    <div style={{ height: "calc(100vh - 57px)", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          // Extra room on the right so header controls don't sit under the
          // fixed power-menu button (top-right corner, present on every screen).
          paddingRight: 60,
          borderBottom: "1px solid var(--border)",
          background: "var(--card)",
          flexShrink: 0,
        }}
      >
        <button className="btn-secondary" style={{ width: "auto", padding: "5px 12px", fontSize: 12 }} onClick={onClose}>
          {t("graph.backToBoard")}
        </button>
        {isOwnProfile && !error && (
          <button className="btn-secondary" style={{ width: "auto" }} onClick={() => setRulesOpen(true)}>
            {t("onboarding.reopenButton")}
          </button>
        )}
      </div>

      <div className="thin-scroll" style={{ flex: 1, overflowY: "auto", padding: "26px 20px", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 560 }}>
          {error ? (
            <div className="form-error">
              {error instanceof ApiError && error.status !== 403 ? error.message : t("profile.accessDenied")}
            </div>
          ) : isLoading || !profile ? (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("common.loading")}</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => profile.user.avatarUrl && setAvatarEnlarged(true)}
                  style={{
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    cursor: profile.user.avatarUrl ? "pointer" : "default",
                    borderRadius: "50%",
                  }}
                >
                  <Avatar displayName={profile.user.displayName} avatarUrl={profile.user.avatarUrl} size={56} fontSize={20} />
                </button>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>{profile.user.displayName}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{roleLabel(profile.user.role, t)}</div>
                  {canManageRole && profile.user.role !== "ADMIN" && (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ width: "auto", padding: "3px 10px", fontSize: 11, marginTop: 6 }}
                      disabled={setMemberRole.isPending}
                      onClick={() => handleToggleRole(profile.user.role as "MENTOR" | "MEMBER")}
                    >
                      {profile.user.role === "MENTOR" ? t("common.makeMember") : t("common.makeMentor")}
                    </button>
                  )}
                </div>
              </div>

              {roleError && (
                <div className="form-error" style={{ marginTop: 10 }}>
                  {roleError}
                </div>
              )}

              {profile.stats && (
                <>
                  <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                    <StatTile label={t("profile.productivity")} value={`${profile.stats.percentage}%`} accent />
                    <StatTile label={t("profile.success")} value={String(profile.stats.successCount)} />
                    <StatTile label={t("profile.fail")} value={String(profile.stats.failCount)} />
                    <StatTile label={t("profile.active")} value={String(profile.stats.activeCount)} />
                  </div>

                  <Section title={t("profile.currentTasks")}>
                    {profile.currentTasks.length === 0 && <Empty text={t("common.none")} />}
                    {profile.currentTasks.map((tk) => (
                      <TaskRow key={tk.id} task={tk} onOpen={() => openTask(tk.id)} />
                    ))}
                  </Section>

                  <Section title={t("profile.successfulTasks")}>
                    {profile.successfulTasks.length === 0 && <Empty text={t("common.none")} />}
                    {profile.successfulTasks.map((tk) => (
                      <TaskRow key={tk.id} task={tk} onOpen={() => openTask(tk.id)} />
                    ))}
                  </Section>

                  <Section title={t("profile.failedTasks")}>
                    {profile.failedTasks.length === 0 && <Empty text={t("common.none")} />}
                    {profile.failedTasks.map((tk) => (
                      <TaskRow key={tk.id} task={tk} onOpen={() => openTask(tk.id)} />
                    ))}
                  </Section>
                </>
              )}

              <Section title={t("profile.documents")}>
                {profile.attachments.length === 0 && <Empty text={t("common.none")} />}
                {profile.attachments.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setPreviewing(a)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px solid var(--border)",
                      padding: "7px 0",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: 13, color: "var(--accent)" }}>{a.originalName}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{formatBytes(a.sizeBytes)}</span>
                  </button>
                ))}
              </Section>

              {ranked.length > 0 && (
                <Section title={t("profile.teamStats")}>
                  {ranked.map((s, i) => (
                    <div
                      key={s.userId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "6px 0",
                        borderBottom: "1px solid var(--border)",
                        fontWeight: s.userId === userId ? 700 : 400,
                      }}
                    >
                      <span style={{ fontSize: 13, color: "var(--ink)" }}>
                        {i + 1}. {membersById.get(s.userId)?.displayName ?? "?"}
                      </span>
                      <span style={{ fontSize: 13, color: "var(--accent)" }}>{s.percentage}%</span>
                    </div>
                  ))}
                </Section>
              )}
            </>
          )}
        </div>
      </div>

      {previewing && <AttachmentPreviewModal attachment={previewing} onClose={() => setPreviewing(null)} />}
      {rulesOpen && <OnboardingModal onClose={() => setRulesOpen(false)} />}
      {avatarEnlarged && profile?.user.avatarUrl && (
        <AvatarLightbox
          avatarUrl={profile.user.avatarUrl}
          displayName={profile.user.displayName}
          onClose={() => setAvatarEnlarged(false)}
        />
      )}
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        background: "var(--paper-panel)",
        borderRadius: 10,
        padding: "10px 12px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, color: accent ? "var(--accent)" : "var(--ink)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ fontSize: 12, color: "var(--muted)" }}>{text}</div>;
}
