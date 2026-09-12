import { useEffect, useState, type CSSProperties } from "react";
import { Plus, Trash2 } from "lucide-react";
import { iconForFile, Folder, FolderOpen, FOLDER_COLOR } from "./fileIcons";

interface Entry {
  name: string;
  isDirectory: boolean;
}

// Shared down through every level of the tree instead of a dozen separate
// props — everything here is either the same reference for the whole tree
// (callbacks) or genuinely needed at every depth (drag state), so a context
// would just add indirection without saving anything real.
interface TreeCtx {
  onOpenFile: (relPath: string) => void;
  activeFile: string | null;
  onRequestCreate: (dirPath: string, kind: "file" | "folder") => void;
  onDelete: (relPath: string, isDirectory: boolean) => void;
  onMove: (fromRelPath: string, toDirPath: string) => void;
  draggingPath: string | null;
  setDraggingPath: (relPath: string | null) => void;
  creatingIn: string | null;
  newName: string;
  setNewName: (v: string) => void;
  onConfirmCreate: () => void;
  onCancelCreate: () => void;
  createError: string | null;
  // Bumped after every create/delete/move so every currently-EXPANDED
  // folder re-fetches its contents — deliberately NOT a remount-the-whole-
  // tree key, which would also reset every folder back to collapsed.
  refreshGen: number;
}

interface NodeProps {
  relPath: string;
  depth: number;
  ctx: TreeCtx;
}

// The inline "name this new file/folder" input — rendered right under
// whichever folder it was requested for (ctx.creatingIn), root included.
function CreateInput({ depth, ctx }: { depth: number; ctx: TreeCtx }) {
  return (
    <div style={{ padding: "2px 8px 6px", paddingLeft: (depth + 1) * 14 + 8 }}>
      {ctx.createError && (
        <div style={{ fontSize: 11, color: "var(--priority-high-ink)", marginBottom: 4 }}>{ctx.createError}</div>
      )}
      <input
        autoFocus
        value={ctx.newName}
        onChange={(e) => ctx.setNewName(e.target.value)}
        onBlur={() => !ctx.newName.trim() && ctx.onCancelCreate()}
        onKeyDown={(e) => {
          if (e.key === "Enter") ctx.onConfirmCreate();
          if (e.key === "Escape") ctx.onCancelCreate();
        }}
        placeholder="ad"
        style={{
          width: "100%",
          padding: "4px 7px",
          border: "1px solid var(--accent)",
          borderRadius: 5,
          background: "var(--paper)",
          fontSize: 12,
          color: "var(--ink)",
        }}
      />
    </div>
  );
}

// Small hover-revealed action icons (new file / new folder / delete) shared
// by both folder headers and file rows — only folders get the two "new"
// icons, matching VS Code's own explorer.
function RowActions({
  hovered,
  isDirectory,
  onNewFile,
  onNewFolder,
  onDelete,
}: {
  hovered: boolean;
  isDirectory: boolean;
  onNewFile?: () => void;
  onNewFolder?: () => void;
  onDelete: () => void;
}) {
  if (!hovered) return null;
  const iconBtnStyle: CSSProperties = {
    border: "none",
    background: "transparent",
    color: "var(--muted)",
    padding: 3,
    display: "flex",
    cursor: "pointer",
    flexShrink: 0,
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: "auto" }}>
      {isDirectory && onNewFile && (
        <button
          title="Yeni fayl"
          style={iconBtnStyle}
          onClick={(e) => {
            e.stopPropagation();
            onNewFile();
          }}
        >
          <Plus size={13} />
        </button>
      )}
      {isDirectory && onNewFolder && (
        <button
          title="Yeni qovluq"
          style={iconBtnStyle}
          onClick={(e) => {
            e.stopPropagation();
            onNewFolder();
          }}
        >
          <Folder size={12} />
        </button>
      )}
      <button
        title="Sil"
        style={iconBtnStyle}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function FolderNode({ relPath, depth, ctx }: NodeProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [hovered, setHovered] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (expanded) window.ideAPI!.readDir(relPath).then(setEntries);
    // ctx.refreshGen deliberately included: re-fetches THIS folder's
    // contents after any create/delete/move in the tree, without
    // unmounting (and so without losing `expanded`) the way a key-based
    // full-tree remount would.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, relPath, ctx.refreshGen]);

  const label = relPath.split("/").pop() ?? relPath;

  return (
    <div>
      {depth > 0 && (
        <div
          onClick={() => setExpanded((e) => !e)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.setData("text/x-taskomania-path", relPath);
            e.dataTransfer.effectAllowed = "move";
            ctx.setDraggingPath(relPath);
          }}
          onDragEnd={() => ctx.setDraggingPath(null)}
          onDragOver={(e) => {
            if (!ctx.draggingPath || ctx.draggingPath === relPath) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onDragEnter={(e) => {
            if (!ctx.draggingPath || ctx.draggingPath === relPath) return;
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
            const from = e.dataTransfer.getData("text/x-taskomania-path");
            if (from) ctx.onMove(from, relPath);
          }}
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
            background: dragOver ? "var(--accent-paper)" : "transparent",
            opacity: ctx.draggingPath === relPath ? 0.4 : 1,
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
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
              flex: hovered ? "0 1 auto" : 1,
            }}
          >
            {label}
          </span>
          <RowActions
            hovered={hovered}
            isDirectory
            onNewFile={() => {
              setExpanded(true);
              ctx.onRequestCreate(relPath, "file");
            }}
            onNewFolder={() => {
              setExpanded(true);
              ctx.onRequestCreate(relPath, "folder");
            }}
            onDelete={() => ctx.onDelete(relPath, true)}
          />
        </div>
      )}
      {expanded && ctx.creatingIn === relPath && <CreateInput depth={depth} ctx={ctx} />}
      {expanded &&
        entries?.map((entry) => {
          const childPath = relPath ? `${relPath}/${entry.name}` : entry.name;
          return entry.isDirectory ? (
            <FolderNode key={entry.name} relPath={childPath} depth={depth + 1} ctx={ctx} />
          ) : (
            <FileRow key={entry.name} relPath={childPath} name={entry.name} depth={depth} ctx={ctx} />
          );
        })}
    </div>
  );
}

function FileRow({
  relPath,
  name,
  depth,
  ctx,
}: {
  relPath: string;
  name: string;
  depth: number;
  ctx: TreeCtx;
}) {
  const { Icon, color } = iconForFile(name);
  const [hovered, setHovered] = useState(false);
  const active = ctx.activeFile === relPath;
  return (
    <div
      onClick={() => ctx.onOpenFile(relPath)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData("text/x-taskomania-path", relPath);
        e.dataTransfer.effectAllowed = "move";
        ctx.setDraggingPath(relPath);
      }}
      onDragEnd={() => ctx.setDraggingPath(null)}
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
        opacity: ctx.draggingPath === relPath ? 0.4 : 1,
      }}
    >
      <Icon size={14} color={color} strokeWidth={2} style={{ flexShrink: 0 }} />
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
          flex: hovered ? "0 1 auto" : 1,
        }}
      >
        {name}
      </span>
      <RowActions hovered={hovered} isDirectory={false} onDelete={() => ctx.onDelete(relPath, false)} />
    </div>
  );
}

// Lazily expands folders one level at a time (readDir on first expand,
// cached after) rather than walking the whole tree upfront — stays fast
// even on large projects, matches how every real IDE's file explorer works.
//
// Creation is an inline text input, NOT window.prompt() (Electron's
// Chromium doesn't implement the native blocking prompt() dialog at all —
// it throws "is and will not be supported" as a rejected promise, not a
// real synchronous return) — but window.confirm()/alert() ARE supported,
// used below for delete/move errors.
export default function FileTree({
  onOpenFile,
  activeFile,
  onPathRemoved,
  onPathMoved,
}: {
  onOpenFile: (relPath: string) => void;
  activeFile: string | null;
  onPathRemoved?: (relPath: string, isDirectory: boolean) => void;
  onPathMoved?: (fromRelPath: string, toRelPath: string) => void;
}) {
  const [refreshGen, setRefreshGen] = useState(0);

  // External changes (npm create vite@latest run in the built-in terminal,
  // git, another editor) don't go through any of this component's own
  // create/delete/move handlers — without this, they'd stay invisible
  // until the whole IDE window was closed and reopened.
  useEffect(() => {
    return window.ideAPI!.onFsChanged(() => setRefreshGen((n) => n + 1));
  }, []);

  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [creatingKind, setCreatingKind] = useState<"file" | "folder">("file");
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [draggingPath, setDraggingPath] = useState<string | null>(null);
  const [rootDragOver, setRootDragOver] = useState(false);

  function requestCreate(dirPath: string, kind: "file" | "folder") {
    setCreatingIn(dirPath);
    setCreatingKind(kind);
    setNewName("");
    setCreateError(null);
  }

  function cancelCreate() {
    setCreatingIn(null);
    setNewName("");
    setCreateError(null);
  }

  async function confirmCreate() {
    const name = newName.trim();
    if (!name || creatingIn === null) return;
    const fullPath = creatingIn ? `${creatingIn}/${name}` : name;
    setCreateError(null);
    try {
      if (creatingKind === "file") await window.ideAPI!.createFile(fullPath);
      else await window.ideAPI!.createFolder(fullPath);
      setRefreshGen((n) => n + 1);
      cancelCreate();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Yaradıla bilmədi");
    }
  }

  async function handleDelete(relPath: string, isDirectory: boolean) {
    const label = relPath.split("/").pop();
    const question = isDirectory
      ? `"${label}" qovluğunu (içindəki hər şeylə birlikdə) silmək istədiyinizə əminsiniz?`
      : `"${label}" faylını silmək istədiyinizə əminsiniz?`;
    if (!window.confirm(question)) return;
    try {
      await window.ideAPI!.deletePath(relPath);
      onPathRemoved?.(relPath, isDirectory);
      setRefreshGen((n) => n + 1);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Silinə bilmədi");
    }
  }

  async function handleMove(fromRelPath: string, toDirPath: string) {
    setDraggingPath(null);
    if (fromRelPath === toDirPath) return;
    if (toDirPath === fromRelPath || toDirPath.startsWith(fromRelPath + "/")) {
      window.alert("Qovluğu öz daxilinə köçürmək olmaz");
      return;
    }
    const fromParent = fromRelPath.includes("/") ? fromRelPath.slice(0, fromRelPath.lastIndexOf("/")) : "";
    if (fromParent === toDirPath) return; // already there
    const baseName = fromRelPath.split("/").pop()!;
    const toRelPath = toDirPath ? `${toDirPath}/${baseName}` : baseName;
    try {
      await window.ideAPI!.renamePath(fromRelPath, toRelPath);
      onPathMoved?.(fromRelPath, toRelPath);
      setRefreshGen((n) => n + 1);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Köçürülə bilmədi");
    }
  }

  const ctx: TreeCtx = {
    onOpenFile,
    activeFile,
    onRequestCreate: requestCreate,
    onDelete: handleDelete,
    onMove: handleMove,
    draggingPath,
    setDraggingPath,
    creatingIn,
    newName,
    setNewName,
    onConfirmCreate: confirmCreate,
    onCancelCreate: cancelCreate,
    createError,
    refreshGen,
  };

  return (
    <div
      style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}
      onDragOver={(e) => {
        if (!draggingPath) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDragEnter={(e) => {
        if (!draggingPath) return;
        e.preventDefault();
        setRootDragOver(true);
      }}
      onDragLeave={() => setRootDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setRootDragOver(false);
        const from = e.dataTransfer.getData("text/x-taskomania-path");
        if (from) handleMove(from, "");
      }}
    >
      <div style={{ display: "flex", gap: 6, padding: "0 8px 8px" }}>
        <button
          onClick={() => requestCreate("", "file")}
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
          onClick={() => requestCreate("", "folder")}
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
      {creatingIn === "" && <CreateInput depth={0} ctx={ctx} />}
      <FolderNode relPath="" depth={0} ctx={ctx} />
      <div style={{ minHeight: 24, flex: 1, background: rootDragOver ? "var(--accent-paper)" : "transparent" }} />
    </div>
  );
}
