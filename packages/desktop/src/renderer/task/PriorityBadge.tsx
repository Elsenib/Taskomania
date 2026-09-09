import type { Priority } from "@team-tracker/shared";

const LABELS: Record<Priority, string> = { LOW: "Aşağı", MEDIUM: "Orta", HIGH: "Yüksək" };

export const PRIORITY_INK: Record<Priority, string> = {
  LOW: "var(--priority-low-ink)",
  MEDIUM: "var(--priority-medium-ink)",
  HIGH: "var(--priority-high-ink)",
};

export const PRIORITY_DOT: Record<Priority, string> = {
  LOW: "var(--priority-low-dot)",
  MEDIUM: "var(--priority-medium-dot)",
  HIGH: "var(--priority-high-dot)",
};

export default function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: PRIORITY_DOT[priority],
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--muted)" }}>{LABELS[priority]}</span>
    </span>
  );
}
