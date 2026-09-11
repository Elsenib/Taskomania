import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useThemeStore, type ThemePreference } from "../store/themeStore";
import { useLocaleStore, type Locale } from "../store/localeStore";
import { useColumns, useRenameColumn } from "../hooks/useColumns";
import { useProjects, useCreateProject, useDeleteProject } from "../hooks/useProjects";
import { useTeamActivity } from "../hooks/useTeamActivity";
import { useTeamMembers } from "../hooks/useTeamMembers";
import AvatarPicker from "../components/AvatarPicker";
import { ApiError } from "../api/client";
import { formatShortDateTime } from "../lib/formatDate";
import { groupColor } from "../lib/color";
import { useT } from "../i18n/useT";
import type { TranslationKey } from "../i18n/translations";
import type { Column } from "@team-tracker/shared";

// Every row — indented sub-column or not — uses the same 3-column grid
// (fixed indent gutter, flexible input, auto-width button) so the input
// itself is always the same width regardless of nesting depth.
function ColumnRenameRow({ column, teamId, indent }: { column: Column; teamId: string; indent: boolean }) {
  const t = useT();
  const [name, setName] = useState(column.name);
  const rename = useRenameColumn(teamId);
  const dirty = name.trim() !== column.name && name.trim().length > 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 8, alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "var(--muted)", textAlign: "center" }}>{indent ? "↳" : ""}</span>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{
          padding: "6px 10px",
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "var(--paper)",
          fontSize: 13,
          color: "var(--ink)",
        }}
      />
      <button
        className="btn-secondary"
        style={{ width: "auto", padding: "5px 10px", fontSize: 12 }}
        disabled={!dirty || rename.isPending}
        onClick={() => rename.mutate({ columnId: column.id, name: name.trim() })}
      >
        {t("common.save")}
      </button>
    </div>
  );
}

function AdminColumnsSection({ teamId }: { teamId: string }) {
  const t = useT();
  const { data: columns } = useColumns(teamId);
  const topLevel = (columns ?? []).filter((c) => !c.parentId).sort((a, b) => a.order - b.order);
  const childrenOf = (parentId: string) =>
    (columns ?? []).filter((c) => c.parentId === parentId).sort((a, b) => a.order - b.order);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {topLevel.map((column) => (
        <div key={column.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <ColumnRenameRow column={column} teamId={teamId} indent={false} />
          {childrenOf(column.id).map((child) => (
            <ColumnRenameRow key={child.id} column={child} teamId={teamId} indent />
          ))}
        </div>
      ))}
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}>{t("settings.addColumnHint")}</p>
    </div>
  );
}

function AdminProjectsSection({ teamId }: { teamId: string }) {
  const t = useT();
  const { data: projects } = useProjects(teamId);
  const createProject = useCreateProject(teamId);
  const deleteProject = useDeleteProject(teamId);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!name.trim()) return;
    setError(null);
    try {
      await createProject.mutateAsync(name.trim());
      setName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("settings.projectSaveFailed"));
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {error && <div className="form-error">{error}</div>}
      {(projects ?? []).length === 0 && (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("settings.projectsEmpty")}</div>
      )}
      {(projects ?? []).map((project, i) => (
        <div key={project.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{ width: 9, height: 9, borderRadius: "50%", background: groupColor(i), flexShrink: 0 }}
          />
          <span style={{ flex: 1, fontSize: 13, color: "var(--ink)" }}>{project.name}</span>
          <button
            className="btn-secondary"
            style={{ width: "auto", padding: "4px 10px", fontSize: 12, color: "var(--priority-high-ink)" }}
            disabled={deleteProject.isPending}
            onClick={() => deleteProject.mutate(project.id)}
          >
            {t("common.delete")}
          </button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder={t("settings.addProjectPlaceholder")}
          style={{
            flex: 1,
            padding: "6px 10px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--paper)",
            fontSize: 13,
            color: "var(--ink)",
          }}
        />
        <button
          className="btn-secondary"
          style={{ width: "auto", padding: "5px 10px", fontSize: 12 }}
          disabled={!name.trim() || createProject.isPending}
          onClick={handleAdd}
        >
          {t("common.add")}
        </button>
      </div>
    </div>
  );
}

const ACTION_KEYS: Record<string, TranslationKey> = {
  TAKE: "activity.take",
  IN_PROGRESS: "activity.inProgress",
  TESTING: "activity.testing",
  DONE: "activity.done",
  FAIL: "activity.fail",
  TODO: "activity.todo",
  CUSTOM: "activity.generic",
};

function AdminAuditSection({ teamId }: { teamId: string }) {
  const t = useT();
  const { data: activity, isLoading } = useTeamActivity(teamId, true);
  const { data: members } = useTeamMembers(teamId);
  const { data: columns } = useColumns(teamId);
  const membersById = new Map((members ?? []).map((m) => [m.id, m]));
  const columnsById = new Map((columns ?? []).map((c) => [c.id, c]));

  if (isLoading) return <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("common.loading")}</div>;

  return (
    <div
      className="thin-scroll"
      style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}
    >
      {(activity ?? []).length === 0 && (
        <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("settings.auditEmpty")}</div>
      )}
      {(activity ?? []).map((entry) => {
        const who = membersById.get(entry.userId)?.displayName ?? t("common.unknownUser");
        const toColumn = columnsById.get(entry.toColumnId);
        const actionKey = (toColumn && ACTION_KEYS[toColumn.type]) ?? "activity.generic";
        return (
          <div
            key={entry.id}
            style={{
              background: "var(--paper-panel)",
              borderRadius: 8,
              padding: "8px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "var(--ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {entry.taskTitle}
              </span>
              <span style={{ fontSize: 11, color: "var(--accent)", flexShrink: 0 }}>{t(actionKey)}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              {who} · {formatShortDateTime(entry.createdAt)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface Props {
  onClose: () => void;
}

export default function SettingsScreen({ onClose }: Props) {
  const { user, updateProfile } = useAuth();
  const t = useT();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
    { value: "system", label: t("settings.themeSystem") },
    { value: "light", label: t("settings.themeLight") },
    { value: "dark", label: t("settings.themeDark") },
  ];
  const LOCALE_OPTIONS: { value: Locale; label: string }[] = [
    { value: "az", label: t("settings.languageAz") },
    { value: "en", label: t("settings.languageEn") },
  ];

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  if (!user) return null;

  async function handleSaveName() {
    if (!displayName.trim() || displayName.trim() === user!.displayName) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ displayName: displayName.trim() });
      setSavedNote(t("settings.nameSaved"));
      setTimeout(() => setSavedNote(null), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("settings.nameSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(dataUri: string) {
    setError(null);
    try {
      await updateProfile({ avatarUrl: dataUri });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("settings.avatarSaveFailed"));
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)", zIndex: 100 }}
      onClick={onClose}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 420,
          height: "100%",
          background: "var(--card)",
          borderLeft: "1px solid var(--border)",
          padding: 26,
          // Extra clearance so the header row (title + Close button) doesn't
          // sit under the fixed power-menu button (top-right corner, present
          // on every screen).
          paddingTop: 56,
          overflowY: "auto",
        }}
        className="thin-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontWeight: 600, fontSize: 16, color: "var(--ink)" }}>{t("settings.title")}</h3>
          <button className="btn-secondary" style={{ width: "auto" }} onClick={onClose}>
            {t("common.close")}
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="field">
          <label>{t("settings.avatarLabel")}</label>
          <AvatarPicker displayName={user.displayName} avatarUrl={user.avatarUrl} onChange={handleAvatarChange} />
        </div>

        <div className="field">
          <label>{t("settings.nameLabel")}</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{
                flex: 1,
                padding: "8px 10px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "var(--paper)",
                fontSize: 14,
                color: "var(--ink)",
              }}
            />
            <button
              className="btn-primary"
              style={{ width: "auto", padding: "8px 14px" }}
              disabled={saving || !displayName.trim() || displayName.trim() === user.displayName}
              onClick={handleSaveName}
            >
              {t("common.save")}
            </button>
          </div>
          {savedNote && <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 6 }}>{savedNote}</div>}
        </div>

        <div className="field">
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20" />
            </svg>
            {t("settings.themeLabel")}
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                className={theme === opt.value ? "btn-primary" : "btn-secondary"}
                style={{ width: "auto", padding: "6px 14px", fontSize: 12 }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 8h14M5 8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9M9 3v5m6 6-4 10m9-10-4 10m-6-7h11" />
            </svg>
            {t("settings.languageLabel")}
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {LOCALE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLocale(opt.value)}
                className={locale === opt.value ? "btn-primary" : "btn-secondary"}
                style={{ width: "auto", padding: "6px 14px", fontSize: 12 }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {user.role === "ADMIN" && (
          <>
            <hr style={{ margin: "22px 0", border: "none", borderTop: "1px solid var(--border)" }} />
            <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}>
              {t("settings.columnsAdmin")}
            </h4>
            <AdminColumnsSection teamId={user.teamId} />

            <h4 style={{ margin: "22px 0 12px", fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}>
              {t("settings.projectsAdmin")}
            </h4>
            <AdminProjectsSection teamId={user.teamId} />

            <h4 style={{ margin: "22px 0 12px", fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}>
              {t("settings.auditTitle")}
            </h4>
            <AdminAuditSection teamId={user.teamId} />
          </>
        )}
      </div>
    </div>
  );
}
