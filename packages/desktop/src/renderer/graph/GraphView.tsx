import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { NodeObject, LinkObject } from "react-force-graph-2d";
import type { Task } from "@team-tracker/shared";
import { useGraphData } from "../hooks/useGraphData";
import { useRealtimeSync } from "../hooks/useRealtimeSync";
import { useUiStore } from "../store/uiStore";
import TaskDetailModal from "../task/TaskDetailModal";
import GraphLegend, { GraphGroup } from "./GraphLegend";
import { useT } from "../i18n/useT";
import { groupColor } from "../lib/color";

// A clean "knowledge graph explorer" look — small flat dots grouped by
// color, thin low-opacity edges, dark analytical background, legend +
// click-to-focus instead of a busy always-on layout. Canvas drawing can't
// read CSS custom properties, so these are plain hex/rgba literals.
const BG = "#0a0e14";
const TEXT = "#e6edf3";
const MUTED = "#7d8590";
const MEMBER_COLOR = "#4fa8ff";
const ATTACHMENT_COLOR = "#8b95a1";
const DEP_RED = "#ff6b5e";
const RING = "#ffffff";

type NodeKind = "task" | "member" | "attachment";

interface GNode {
  id: string;
  kind: NodeKind;
  label: string;
  color: string;
  groupKey: string;
}

interface GLink {
  source: string;
  target: string;
  kind: "assignee" | "dependency" | "attachment";
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// After the first simulation tick, force-graph mutates link.source/target
// from plain id strings into references to the actual node objects — so any
// code comparing endpoints has to handle both shapes.
function endpointId(endpoint: unknown): string {
  if (typeof endpoint === "string") return endpoint;
  return (endpoint as { id: string }).id;
}

export default function GraphView({
  teamId,
  onExit,
  onOpenProfile,
}: {
  teamId: string;
  onExit: () => void;
  onOpenProfile: (userId: string) => void;
}) {
  const t = useT();
  const { data, isLoading, isError, refetch } = useGraphData(teamId);
  useRealtimeSync(teamId);

  const openTaskId = useUiStore((s) => s.openTaskId);
  const openTask = useUiStore((s) => s.openTask);

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Each team member gets a distinct, stable color — a task's node (and its
  // assignee link) is colored by WHO owns it rather than which column it
  // currently sits in, so a member's work is visually traceable across the
  // whole board at a glance (the competitive/accountability angle from the
  // workflow spec: "hər üzvün qrafda rəngi fərqli olacaq").
  const memberColorById = useMemo(() => {
    const map = new Map<string, string>();
    (data?.members ?? []).forEach((m, i) => map.set(m.id, groupColor(i)));
    return map;
  }, [data?.members]);

  const allNodesAndLinks = useMemo(() => {
    const nodes: GNode[] = [];
    const links: GLink[] = [];
    if (!data) return { nodes, links };

    for (const member of data.members) {
      nodes.push({
        id: member.id,
        kind: "member",
        label: member.displayName,
        color: memberColorById.get(member.id) ?? MEMBER_COLOR,
        groupKey: `member:${member.id}`,
      });
    }
    for (const task of data.tasks) {
      const color = task.assigneeId ? memberColorById.get(task.assigneeId) ?? MUTED : MUTED;
      nodes.push({
        id: task.id,
        kind: "task",
        label: task.title,
        color,
        groupKey: task.assigneeId ? `member:${task.assigneeId}` : "unassigned",
      });
      if (task.assigneeId) {
        links.push({ source: task.id, target: task.assigneeId, kind: "assignee" });
      }
    }
    for (const attachment of data.attachments) {
      nodes.push({
        id: attachment.id,
        kind: "attachment",
        label: attachment.originalName,
        color: ATTACHMENT_COLOR,
        groupKey: "attachments",
      });
      links.push({ source: attachment.taskId, target: attachment.id, kind: "attachment" });
    }
    for (const dep of data.dependencies) {
      links.push({ source: dep.blockingTaskId, target: dep.blockedTaskId, kind: "dependency" });
    }
    return { nodes, links };
  }, [data, memberColorById]);

  const groups: GraphGroup[] = useMemo(() => {
    if (!data) return [];
    const list: GraphGroup[] = data.members.map((m) => ({
      key: `member:${m.id}`,
      label: m.displayName,
      color: memberColorById.get(m.id) ?? MEMBER_COLOR,
      count: data.tasks.filter((t) => t.assigneeId === m.id).length,
    }));
    const unassignedCount = data.tasks.filter((t) => !t.assigneeId).length;
    if (unassignedCount > 0) {
      list.push({ key: "unassigned", label: t("graph.unassigned"), color: MUTED, count: unassignedCount });
    }
    if (data.attachments.length > 0) {
      list.push({ key: "attachments", label: t("graph.files"), color: ATTACHMENT_COLOR, count: data.attachments.length });
    }
    return list;
  }, [data, memberColorById, t]);

  const graphData = useMemo(() => {
    const nodes = allNodesAndLinks.nodes.filter((n) => !hiddenGroups.has(n.groupKey));
    const visibleIds = new Set(nodes.map((n) => n.id));
    const links = allNodesAndLinks.links.filter(
      (l) => visibleIds.has(endpointId(l.source)) && visibleIds.has(endpointId(l.target))
    );
    return { nodes, links };
  }, [allNodesAndLinks, hiddenGroups]);

  // Everything directly touching the selected node — used to dim the rest
  // of the graph on click, per "əlaqəli olan işıqlansın".
  const focus = useMemo(() => {
    if (!selectedId) return null;
    const neighborIds = new Set<string>([selectedId]);
    const connectedLinks = new Set<GLink>();
    for (const link of graphData.links) {
      const s = endpointId(link.source);
      const t = endpointId(link.target);
      if (s === selectedId || t === selectedId) {
        neighborIds.add(s === selectedId ? t : s);
        connectedLinks.add(link);
      }
    }
    return { neighborIds, connectedLinks };
  }, [selectedId, graphData.links]);

  const tasksById = useMemo(() => new Map((data?.tasks ?? []).map((t) => [t.id, t])), [data]);
  const openTaskObj: Task | undefined = openTaskId ? tasksById.get(openTaskId) : undefined;
  const selectedNode = selectedId ? graphData.nodes.find((n) => n.id === selectedId) : undefined;

  function toggleGroup(key: string) {
    setHiddenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setHiddenGroups((prev) => (prev.size === 0 ? new Set(groups.map((g) => g.key)) : new Set()));
  }

  return (
    <div style={{ height: "calc(100vh - 57px)", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          // Extra room on the right so the count text doesn't sit under the
          // fixed power-menu button (top-right corner, present on every screen).
          paddingRight: 60,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: BG,
        }}
      >
        <button
          type="button"
          onClick={onExit}
          style={{
            width: "auto",
            padding: "5px 12px",
            fontSize: 12,
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 8,
            background: "transparent",
            color: TEXT,
            cursor: "pointer",
          }}
        >
          {t("graph.backToBoard")}
        </button>
        <span style={{ fontSize: 12, color: MUTED }}>
          {data
            ? `${data.tasks.length} ${t("graph.tasksCount")} · ${data.members.length} ${t("graph.membersCount")} · ${data.dependencies.length} ${t("graph.dependenciesCount")}`
            : ""}
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <div ref={containerRef} style={{ flex: 1, minWidth: 0, minHeight: 0, position: "relative", background: BG }}>
          {isLoading && <div style={{ padding: 24, color: MUTED }}>{t("common.loading")}</div>}
          {isError && (
            <div style={{ padding: 24 }}>
              <div className="form-error" style={{ display: "inline-block" }}>
                {t("graph.loadError")}
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="btn-secondary" style={{ width: "auto" }} onClick={() => refetch()}>
                  {t("common.retry")}
                </button>
              </div>
            </div>
          )}
          {!isLoading && !isError && data && (
            <>
              <ForceGraph2D
                width={size.width}
                height={size.height}
                graphData={graphData}
                backgroundColor={BG}
                nodeId="id"
                nodeRelSize={4}
                linkColor={(link: LinkObject) => {
                  const l = link as unknown as GLink;
                  const base =
                    l.kind === "dependency"
                      ? DEP_RED
                      : l.kind === "assignee"
                        ? memberColorById.get(endpointId(l.target)) ?? MEMBER_COLOR
                        : ATTACHMENT_COLOR;
                  if (!focus) return hexToRgba(base, l.kind === "dependency" ? 0.6 : 0.18);
                  return hexToRgba(base, focus.connectedLinks.has(l) ? 0.9 : 0.03);
                }}
                linkWidth={(link: LinkObject) => ((link as unknown as GLink).kind === "dependency" ? 1.5 : 1)}
                linkLineDash={(link: LinkObject) =>
                  (link as unknown as GLink).kind === "attachment" ? [2, 2] : null
                }
                linkDirectionalArrowLength={(link: LinkObject) =>
                  (link as unknown as GLink).kind === "dependency" ? 5 : 0
                }
                linkDirectionalArrowRelPos={1}
                linkDirectionalArrowColor={(link: LinkObject) => {
                  const l = link as unknown as GLink;
                  if (!focus) return hexToRgba(DEP_RED, 0.6);
                  return hexToRgba(DEP_RED, focus.connectedLinks.has(l) ? 0.9 : 0.03);
                }}
                nodeCanvasObject={(node: NodeObject, ctx, globalScale) => {
                  const n = node as unknown as GNode & { x: number; y: number };
                  const baseRadius = n.kind === "member" ? 7 : n.kind === "attachment" ? 3.5 : 5;
                  const isSelected = n.id === selectedId;
                  const isDimmed = Boolean(focus) && !focus!.neighborIds.has(n.id);

                  ctx.globalAlpha = isDimmed ? 0.12 : 1;
                  ctx.beginPath();
                  ctx.arc(n.x, n.y, isSelected ? baseRadius + 2 : baseRadius, 0, 2 * Math.PI);
                  ctx.fillStyle = n.color;
                  ctx.fill();
                  if (isSelected) {
                    ctx.lineWidth = 2 / globalScale;
                    ctx.strokeStyle = RING;
                    ctx.stroke();
                  }

                  if (!isDimmed) {
                    const fontSize = 11 / globalScale;
                    ctx.font = `${isSelected ? "600" : "400"} ${fontSize}px ${window.getComputedStyle(document.body).fontFamily}`;
                    ctx.fillStyle = isSelected ? TEXT : MUTED;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "top";
                    ctx.fillText(n.label, n.x, n.y + baseRadius + 3);
                  }
                  ctx.globalAlpha = 1;
                }}
                nodePointerAreaPaint={(node: NodeObject, color, ctx) => {
                  const n = node as unknown as GNode & { x: number; y: number };
                  const radius = n.kind === "member" ? 7 : n.kind === "attachment" ? 3.5 : 5;
                  ctx.fillStyle = color;
                  ctx.beginPath();
                  ctx.arc(n.x, n.y, radius + 2, 0, 2 * Math.PI);
                  ctx.fill();
                }}
                onNodeClick={(node: NodeObject) => {
                  const n = node as unknown as GNode;
                  setSelectedId((prev) => (prev === n.id ? null : n.id));
                }}
                onBackgroundClick={() => setSelectedId(null)}
              />

              {selectedNode && (
                <div
                  style={{
                    position: "absolute",
                    left: 16,
                    bottom: 16,
                    background: "#10151f",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    maxWidth: 320,
                  }}
                >
                  <span
                    style={{ width: 9, height: 9, borderRadius: "50%", background: selectedNode.color, flexShrink: 0 }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      color: TEXT,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {selectedNode.label}
                  </span>
                  {selectedNode.kind === "task" && (
                    <button
                      type="button"
                      onClick={() => openTask(selectedNode.id)}
                      style={{
                        border: "none",
                        background: MEMBER_COLOR,
                        color: "#04101c",
                        borderRadius: 6,
                        padding: "4px 10px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      {t("graph.open")}
                    </button>
                  )}
                  {selectedNode.kind === "member" && (
                    <button
                      type="button"
                      onClick={() => onOpenProfile(selectedNode.id)}
                      style={{
                        border: "none",
                        background: selectedNode.color,
                        color: "#04101c",
                        borderRadius: 6,
                        padding: "4px 10px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      {t("graph.openProfile")}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {data && (
          <GraphLegend groups={groups} hidden={hiddenGroups} onToggle={toggleGroup} onToggleAll={toggleAll} />
        )}
      </div>

      {openTaskObj && (
        <TaskDetailModal
          teamId={teamId}
          task={openTaskObj}
          newTaskColumnId={null}
          members={data?.members ?? []}
          allTasks={data?.tasks ?? []}
        />
      )}
    </div>
  );
}
