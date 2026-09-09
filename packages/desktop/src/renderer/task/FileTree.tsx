import { useState } from "react";
import type { FileTreeNode } from "@team-tracker/shared";

interface Props {
  nodes: FileTreeNode[];
  selectedPath: string | null;
  onSelect: (node: FileTreeNode) => void;
  depth?: number;
}

interface RowProps {
  node: FileTreeNode;
  selectedPath: string | null;
  onSelect: (node: FileTreeNode) => void;
  depth: number;
}

export default function FileTree({ nodes, selectedPath, onSelect, depth = 0 }: Props) {
  return (
    <div>
      {nodes.map((node) => (
        <TreeRow key={node.path} node={node} selectedPath={selectedPath} onSelect={onSelect} depth={depth} />
      ))}
    </div>
  );
}

function TreeRow({ node, selectedPath, onSelect, depth }: RowProps) {
  const [open, setOpen] = useState(depth < 1);
  const isSelected = node.type === "file" && node.path === selectedPath;

  if (node.type === "dir") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            width: "100%",
            padding: "4px 6px",
            paddingLeft: 6 + depth * 14,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: 13,
            color: "var(--ink)",
            textAlign: "left",
          }}
        >
          <span style={{ color: "var(--muted)", fontSize: 10, width: 10, display: "inline-block" }}>
            {open ? "▾" : "▸"}
          </span>
          {node.name}
        </button>
        {open && node.children && (
          <FileTree nodes={node.children} selectedPath={selectedPath} onSelect={onSelect} depth={depth + 1} />
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(node)}
      style={{
        display: "block",
        width: "100%",
        padding: "4px 6px",
        paddingLeft: 20 + depth * 14,
        border: "none",
        background: isSelected ? "var(--accent-paper)" : "transparent",
        cursor: "pointer",
        fontSize: 13,
        color: isSelected ? "var(--accent)" : "var(--ink-soft)",
        fontWeight: isSelected ? 600 : 400,
        textAlign: "left",
        borderRadius: 4,
      }}
    >
      {node.name}
    </button>
  );
}
