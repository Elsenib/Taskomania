import { useEffect, useState } from "react";
import { iconForFile, Folder, FolderOpen, FOLDER_COLOR } from "./fileIcons";

interface Entry {
  name: string;
  isDirectory: boolean;
}

interface NodeProps {
  relPath: string;
  depth: number;
  onOpenFile: (relPath: string) => void;
  activeFile: string | null;
}

function FolderNode({ relPath, depth, onOpenFile, activeFile }: NodeProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    if (expanded && entries === null) {
      window.ideAPI!.readDir(relPath).then(setEntries);
    }
  }, [expanded, entries, relPath]);

  const label = relPath.split("/").pop() ?? relPath;

  return (
    <div>
      {depth > 0 && (
        <div
          onClick={() => setExpanded((e) => !e)}
          style={{
            cursor: "pointer",
            fontSize: 12.5,
            padding: "3px 6px",
            paddingLeft: depth * 14,
            display: "flex",
            alignItems: "center",
            gap: 5,
            color: "var(--ink)",
            userSelect: "none",
          }}
        >
          <span style={{ width: 10, display: "inline-block", color: "var(--muted)", flexShrink: 0 }}>
            {expanded ? "▾" : "▸"}
          </span>
          {expanded ? (
            <FolderOpen size={14} color={FOLDER_COLOR} strokeWidth={2} style={{ flexShrink: 0 }} />
          ) : (
            <Folder size={14} color={FOLDER_COLOR} strokeWidth={2} style={{ flexShrink: 0 }} />
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        </div>
      )}
      {expanded &&
        entries?.map((entry) => {
          const childPath = relPath ? `${relPath}/${entry.name}` : entry.name;
          return entry.isDirectory ? (
            <FolderNode
              key={entry.name}
              relPath={childPath}
              depth={depth + 1}
              onOpenFile={onOpenFile}
              activeFile={activeFile}
            />
          ) : (
            <FileRow
              key={entry.name}
              name={entry.name}
              depth={depth}
              active={activeFile === childPath}
              onClick={() => onOpenFile(childPath)}
            />
          );
        })}
    </div>
  );
}

function FileRow({
  name,
  depth,
  active,
  onClick,
}: {
  name: string;
  depth: number;
  active: boolean;
  onClick: () => void;
}) {
  const { Icon, color } = iconForFile(name);
  return (
    <div
      onClick={onClick}
      style={{
        cursor: "pointer",
        fontSize: 12.5,
        padding: "3px 6px",
        paddingLeft: (depth + 1) * 14 + 15,
        display: "flex",
        alignItems: "center",
        gap: 5,
        background: active ? "var(--accent-paper)" : "transparent",
        color: "var(--ink)",
        userSelect: "none",
      }}
    >
      <Icon size={14} color={color} strokeWidth={2} style={{ flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
    </div>
  );
}

// Lazily expands folders one level at a time (readDir on first expand,
// cached after) rather than walking the whole tree upfront — stays fast
// even on large projects, matches how every real IDE's file explorer works.
//
// New file/folder creation is root-level only here — an inline text input,
// NOT window.prompt() (Electron's Chromium doesn't implement the native
// blocking prompt() dialog at all — it throws "is and will not be
// supported" as a rejected promise, not a real synchronous return).
// Anything nested is one `mkdir`/`New-Item` away in the terminal, which
// already has full create access anywhere in the project. `refreshToken`
// forces the root FolderNode to remount and refetch after a create.
export default function FileTree({
  onOpenFile,
  activeFile,
}: {
  onOpenFile: (relPath: string) => void;
  activeFile: string | null;
}) {
  const [refreshToken, setRefreshToken] = useState(0);
  const [creating, setCreating] = useState<"file" | "folder" | null>(null);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleConfirmCreate() {
    const name = newName.trim();
    if (!name || !creating) return;
    setCreateError(null);
    try {
      if (creating === "file") await window.ideAPI!.createFile(name);
      else await window.ideAPI!.createFolder(name);
      setRefreshToken((n) => n + 1);
      setCreating(null);
      setNewName("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Yaradıla bilmədi");
    }
  }

  return (
    <div>
      {creating ? (
        <div style={{ padding: "0 8px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
          {createError && <div style={{ fontSize: 11, color: "var(--priority-high-ink)" }}>{createError}</div>}
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirmCreate();
              if (e.key === "Escape") {
                setCreating(null);
                setNewName("");
              }
            }}
            placeholder={creating === "file" ? "fayl.ts" : "qovluq-adı"}
            style={{
              padding: "5px 8px",
              border: "1px solid var(--border)",
              borderRadius: 6,
              background: "var(--paper)",
              fontSize: 12,
              color: "var(--ink)",
            }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={handleConfirmCreate}
              disabled={!newName.trim()}
              className="btn-primary"
              style={{ flex: 1, padding: "4px 0", fontSize: 11 }}
            >
              Yarat
            </button>
            <button
              onClick={() => {
                setCreating(null);
                setNewName("");
              }}
              className="btn-secondary"
              style={{ flex: 1, padding: "4px 0", fontSize: 11 }}
            >
              İmtina
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6, padding: "0 8px 8px" }}>
          <button
            onClick={() => setCreating("file")}
            style={{
              flex: 1,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--muted)",
              fontSize: 11,
              borderRadius: 6,
              padding: "4px 0",
              cursor: "pointer",
            }}
          >
            + Fayl
          </button>
          <button
            onClick={() => setCreating("folder")}
            style={{
              flex: 1,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--muted)",
              fontSize: 11,
              borderRadius: 6,
              padding: "4px 0",
              cursor: "pointer",
            }}
          >
            + Qovluq
          </button>
        </div>
      )}
      <FolderNode key={refreshToken} relPath="" depth={0} onOpenFile={onOpenFile} activeFile={activeFile} />
    </div>
  );
}
