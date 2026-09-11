import type { Column, User } from "@team-tracker/shared";
import { useTaskActivity } from "../hooks/useTaskActivity";
import { formatShortDateTime } from "../lib/formatDate";
import { useT } from "../i18n/useT";
import type { TranslationKey } from "../i18n/translations";

const ACTION_KEYS: Record<string, TranslationKey> = {
  TAKE: "activity.take",
  IN_PROGRESS: "activity.inProgress",
  TESTING: "activity.testing",
  DONE: "activity.done",
  FAIL: "activity.fail",
  TODO: "activity.todo",
  CUSTOM: "activity.generic",
};

interface Props {
  taskId: string;
  columns: Column[];
  membersById: Map<string, User>;
}

export default function TaskActivityTimeline({ taskId, columns, membersById }: Props) {
  const t = useT();
  const { data: activity } = useTaskActivity(taskId);
  const columnsById = new Map(columns.map((c) => [c.id, c]));

  if (!activity || activity.length === 0) return null;

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 8 }}>
        {t("task.historyTitle")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {activity.map((entry) => {
          const toColumn = columnsById.get(entry.toColumnId);
          const who = membersById.get(entry.userId)?.displayName ?? t("common.unknownUser");
          const key = (toColumn && ACTION_KEYS[toColumn.type]) ?? "activity.generic";
          return (
            <div key={entry.id} style={{ fontSize: 12.5, color: "var(--ink)" }}>
              <span style={{ fontWeight: 600 }}>{t(key)}</span>
              {" · "}
              <span style={{ color: "var(--muted)" }}>{who}</span>
              {" · "}
              <span style={{ color: "var(--muted)" }}>{formatShortDateTime(entry.createdAt)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
