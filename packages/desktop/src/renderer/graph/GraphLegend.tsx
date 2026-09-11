import { useT } from "../i18n/useT";

export interface GraphGroup {
  key: string;
  label: string;
  color: string;
  count: number;
}

interface Props {
  groups: GraphGroup[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
  onToggleAll: () => void;
}

export default function GraphLegend({ groups, hidden, onToggle, onToggleAll }: Props) {
  const t = useT();
  const allVisible = hidden.size === 0;

  return (
    <div
      className="dark-scroll"
      style={{
        width: 240,
        flexShrink: 0,
        background: "#10151f",
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        padding: "18px 16px",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: "#7d8590",
          marginBottom: 14,
        }}
      >
        {t("graph.groupsHeading")}
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
          paddingBottom: 12,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          cursor: "pointer",
          fontSize: 13,
          color: "#e6edf3",
          fontWeight: 600,
        }}
      >
        <input
          type="checkbox"
          checked={allVisible}
          onChange={onToggleAll}
          style={{ accentColor: "#4fa8ff", width: 14, height: 14 }}
        />
        {t("graph.selectAll")}
      </label>

      {groups.map((g) => (
        <label
          key={g.key}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "5px 0",
            cursor: "pointer",
            fontSize: 13,
            color: "#e6edf3",
          }}
        >
          <input
            type="checkbox"
            checked={!hidden.has(g.key)}
            onChange={() => onToggle(g.key)}
            style={{ accentColor: "#4fa8ff", width: 14, height: 14, flexShrink: 0 }}
          />
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: g.color,
              flexShrink: 0,
            }}
          />
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {g.label}
          </span>
          <span style={{ color: "#7d8590", fontSize: 12, flexShrink: 0 }}>{g.count}</span>
        </label>
      ))}
    </div>
  );
}
