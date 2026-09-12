import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { NodeObject } from "react-force-graph-2d";
import { groupColor } from "../lib/color";

const BG = "#0a0e14";
const TEXT = "#e6edf3";
const MUTED = "#7d8590";

interface RawGraph {
  nodes: { id: string; label: string; ext: string }[];
  links: { source: string; target: string }[];
}

interface GNode {
  id: string;
  label: string;
  color: string;
}

// Same idea as graph/GraphView.tsx (force-directed, click-to-focus) but for
// a project's own import/require graph instead of tasks — scanned by
// main/ide/dependencyScanner.ts and rendered here with the SAME
// react-force-graph-2d dependency the Graph view already uses (no new
// library needed). Clicking a node opens that file in the editor.
export default function DependencyGraphPane({
  projectRoot,
  onOpenFile,
}: {
  projectRoot: string;
  onOpenFile: (relPath: string) => void;
}) {
  const [raw, setRaw] = useState<RawGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 400, height: 400 });

  useEffect(() => {
    setLoading(true);
    window.ideAPI!.scanDependencies(projectRoot).then((g) => {
      setRaw(g);
      setLoading(false);
    });
  }, [projectRoot]);

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

  const extColorByExt = useMemo(() => {
    const exts = Array.from(new Set((raw?.nodes ?? []).map((n) => n.ext)));
    return new Map(exts.map((ext, i) => [ext, groupColor(i)]));
  }, [raw]);

  const graphData = useMemo(() => {
    const nodes: GNode[] = (raw?.nodes ?? []).map((n) => ({
      id: n.id,
      label: n.label,
      color: extColorByExt.get(n.ext) ?? MUTED,
    }));
    return { nodes, links: raw?.links ?? [] };
  }, [raw, extColorByExt]);

  const focus = useMemo(() => {
    if (!selectedId) return null;
    const neighborIds = new Set<string>([selectedId]);
    for (const link of graphData.links) {
      const s = typeof link.source === "string" ? link.source : (link.source as { id: string }).id;
      const t = typeof link.target === "string" ? link.target : (link.target as { id: string }).id;
      if (s === selectedId) neighborIds.add(t);
      if (t === selectedId) neighborIds.add(s);
    }
    return neighborIds;
  }, [selectedId, graphData.links]);

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 13 }}>
        Qraf hesablanır...
      </div>
    );
  }

  if (!raw || raw.nodes.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 13 }}>
        Analiz ediləcək fayl tapılmadı.
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ flex: 1, minWidth: 0, minHeight: 0, position: "relative", background: BG }}>
      <ForceGraph2D
        width={size.width}
        height={size.height}
        graphData={graphData}
        backgroundColor={BG}
        nodeId="id"
        nodeRelSize={4}
        linkColor={() => "rgba(255,255,255,0.15)"}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        nodeCanvasObject={(node: NodeObject, ctx, globalScale) => {
          const n = node as unknown as GNode & { x: number; y: number };
          const isSelected = n.id === selectedId;
          const isDimmed = Boolean(focus) && !focus!.has(n.id);

          ctx.globalAlpha = isDimmed ? 0.15 : 1;
          ctx.beginPath();
          ctx.arc(n.x, n.y, isSelected ? 6 : 4, 0, 2 * Math.PI);
          ctx.fillStyle = n.color;
          ctx.fill();

          if (!isDimmed) {
            const fontSize = 10 / globalScale;
            ctx.font = `${isSelected ? "600" : "400"} ${fontSize}px sans-serif`;
            ctx.fillStyle = isSelected ? TEXT : MUTED;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText(n.label, n.x, n.y + 7);
          }
          ctx.globalAlpha = 1;
        }}
        onNodeClick={(node: NodeObject) => {
          const n = node as unknown as GNode;
          setSelectedId((prev) => (prev === n.id ? null : n.id));
        }}
        onNodeRightClick={(node: NodeObject) => {
          onOpenFile((node as unknown as GNode).id);
        }}
        onBackgroundClick={() => setSelectedId(null)}
      />
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          fontSize: 11,
          color: MUTED,
          background: "rgba(10,14,20,0.7)",
          padding: "5px 9px",
          borderRadius: 6,
        }}
      >
        Klik: seç · Sağ klik: faylı aç
      </div>
    </div>
  );
}
