import { useCallback, useEffect, useRef, useState } from "react";
import {
  PanelLeftClose,
  PanelLeft,
  ChevronDown,
  ChevronUp,
  X,
  Maximize2,
  Minimize2,
  SquareTerminal,
} from "lucide-react";
import FileTree from "./FileTree";
import EditorPane from "./EditorPane";
import ImagePreview from "./ImagePreview";
import TerminalPane from "./TerminalPane";
import DependencyGraphPane from "./DependencyGraphPane";
import { getCodeOriginStats } from "./codeOriginTracker";
import { isImageFile } from "../lib/fileKind";

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 480;
const SIDEBAR_RAIL = 36;
const TERMINAL_MIN = 120;
const TERMINAL_MAX = 640;
const TERMINAL_HEADER_H = 32;

// Root component for the separate IDE window (see main/ide/ideWindow.ts).
// Mounted instead of <App/> when the page loads with ?window=ide — see
// renderer/main.tsx. Deliberately has no dependency on AuthContext/React
// Query/the team API: the IDE is a local dev tool, fully decoupled from
// Taskomania's own team/task data and its own window's session.
export default function IdeApp() {
  const [projectRoot, setProjectRoot] = useState<string | null>(null);
  const [openFilePath, setOpenFilePath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"files" | "graph">("files");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectParent, setNewProjectParent] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  // Sidebar (Fayllar/Qraf) — collapsible down to a slim icon rail, and
  // resizable by dragging its right edge. Same VS Code-style controls as
  // the terminal panel below, requested alongside it.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const sidebarDrag = useRef<{ startX: number; startWidth: number } | null>(null);

  // Terminal — open/close, drag-to-resize, and a VS Code-style "minimize to
  // header strip" collapse, independent of fully closing it. `terminalHeight`
  // is the last user-set height, restored when un-collapsing.
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [terminalCollapsed, setTerminalCollapsed] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(240);
  const [terminalShell, setTerminalShell] = useState<"powershell" | "cmd">("powershell");
  const terminalDrag = useRef<{ startY: number; startHeight: number } | null>(null);

  // The dependency graph is cramped inside the narrow sidebar — this lets it
  // take over the whole content area on demand instead of resizing the
  // sidebar itself (which would also squeeze the file tree).
  const [graphMaximized, setGraphMaximized] = useState(false);

  function startSidebarResize(e: React.MouseEvent) {
    sidebarDrag.current = { startX: e.clientX, startWidth: sidebarWidth };
    window.addEventListener("mousemove", onSidebarResizeMove);
    window.addEventListener("mouseup", endSidebarResize);
  }
  function onSidebarResizeMove(e: MouseEvent) {
    const drag = sidebarDrag.current;
    if (!drag) return;
    const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, drag.startWidth + (e.clientX - drag.startX)));
    setSidebarWidth(next);
  }
  function endSidebarResize() {
    sidebarDrag.current = null;
    window.removeEventListener("mousemove", onSidebarResizeMove);
    window.removeEventListener("mouseup", endSidebarResize);
  }

  function startTerminalResize(e: React.MouseEvent) {
    terminalDrag.current = { startY: e.clientY, startHeight: terminalHeight };
    window.addEventListener("mousemove", onTerminalResizeMove);
    window.addEventListener("mouseup", endTerminalResize);
  }
  function onTerminalResizeMove(e: MouseEvent) {
    const drag = terminalDrag.current;
    if (!drag) return;
    // Dragging up (smaller clientY) should grow the panel, hence the flip.
    const next = Math.min(TERMINAL_MAX, Math.max(TERMINAL_MIN, drag.startHeight + (drag.startY - e.clientY)));
    setTerminalHeight(next);
    if (terminalCollapsed) setTerminalCollapsed(false);
  }
  function endTerminalResize() {
    terminalDrag.current = null;
    window.removeEventListener("mousemove", onTerminalResizeMove);
    window.removeEventListener("mouseup", endTerminalResize);
  }

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", onSidebarResizeMove);
      window.removeEventListener("mouseup", endSidebarResize);
      window.removeEventListener("mousemove", onTerminalResizeMove);
      window.removeEventListener("mouseup", endTerminalResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.ideAPI!.getProjectRoot().then(setProjectRoot);
    window.ideAPI!.getTaskContext().then((ctx) => setTaskId(ctx?.taskId ?? null));
  }, []);

  const isHtmlFile = !!openFilePath && /\.html?$/i.test(openFilePath);

  async function handleToggleGoLive() {
    setLiveError(null);
    if (liveUrl) {
      await window.ideAPI!.goLiveStop();
      setLiveUrl(null);
      return;
    }
    if (!projectRoot || !openFilePath) return;
    try {
      const { url } = await window.ideAPI!.goLiveStart(projectRoot, openFilePath);
      setLiveUrl(url);
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : "Go Live başladıla bilmədi");
    }
  }

  async function handleSaveProjectToTask() {
    setSaveState("saving");
    setSaveError(null);
    try {
      await window.ideAPI!.saveProjectToTask(getCodeOriginStats());
      setSaveState("done");
      setTimeout(() => setSaveState("idle"), 3000);
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : "Yüklənə bilmədi");
    }
  }

  async function handlePickFolder() {
    setError(null);
    const root = await window.ideAPI!.openProjectFolder();
    if (root) {
      setProjectRoot(root);
      setOpenFilePath(null);
      setImagePreviewUrl(null);
      setContent("");
      setDirty(false);
    }
  }

  async function handlePickNewProjectParent() {
    const parent = await window.ideAPI!.pickFolder();
    if (parent) setNewProjectParent(parent);
  }

  async function handleCreateProject() {
    if (!newProjectParent || !newProjectName.trim()) return;
    setError(null);
    try {
      const root = await window.ideAPI!.createNewProject(newProjectParent, newProjectName.trim());
      setProjectRoot(root);
      setOpenFilePath(null);
      setImagePreviewUrl(null);
      setContent("");
      setDirty(false);
      setNewProjectOpen(false);
      setNewProjectParent(null);
      setNewProjectName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Layihə yaradıla bilmədi");
    }
  }

  async function handleOpenFile(relPath: string) {
    if (dirty && !window.confirm("Saxlanılmamış dəyişikliklər var. Davam edilsin?")) return;
    setError(null);
    try {
      if (isImageFile(relPath)) {
        const dataUrl = await window.ideAPI!.readImageDataUrl(relPath);
        setOpenFilePath(relPath);
        setImagePreviewUrl(dataUrl);
        setContent("");
        setDirty(false);
        return;
      }
      const fileContent = await window.ideAPI!.readFile(relPath);
      setOpenFilePath(relPath);
      setImagePreviewUrl(null);
      setContent(fileContent);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fayl açıla bilmədi");
    }
  }

  const handleSave = useCallback(async () => {
    if (!openFilePath || !dirty) return;
    try {
      await window.ideAPI!.writeFile(openFilePath, content);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fayl saxlanıla bilmədi");
    }
  }, [openFilePath, dirty, content]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--paper)",
        color: "var(--ink)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--card)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, overflow: "hidden" }}>
          <span style={{ fontSize: 13, fontWeight: 600, flexShrink: 0 }}>Taskomania IDE</span>
          {projectRoot && (
            <span
              style={{
                fontSize: 11.5,
                color: "var(--muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {projectRoot}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button
            className="btn-secondary"
            style={{ width: "auto", padding: "5px 12px", fontSize: 12 }}
            onClick={() => setNewProjectOpen((o) => !o)}
          >
            Yeni layihə yarat
          </button>
          <button
            className="btn-secondary"
            style={{ width: "auto", padding: "5px 12px", fontSize: 12 }}
            onClick={handlePickFolder}
          >
            {projectRoot ? "Başqa qovluq seç" : "Qovluq seç"}
          </button>
          {openFilePath && (
            <button
              className="btn-primary"
              style={{ width: "auto", padding: "5px 12px", fontSize: 12 }}
              disabled={!dirty}
              onClick={handleSave}
            >
              {dirty ? "Saxla*" : "Saxlanılıb"}
            </button>
          )}
          {(isHtmlFile || liveUrl) && (
            <button
              className="btn-secondary"
              style={{ width: "auto", padding: "5px 12px", fontSize: 12 }}
              onClick={handleToggleGoLive}
            >
              {liveUrl ? "Go Live-ı dayandır" : "Go Live"}
            </button>
          )}
          {taskId && projectRoot && (
            <button
              className="btn-primary"
              style={{ width: "auto", padding: "5px 12px", fontSize: 12 }}
              disabled={saveState === "saving"}
              onClick={handleSaveProjectToTask}
            >
              {saveState === "saving"
                ? "Yüklənir..."
                : saveState === "done"
                  ? "Tapşırığa saxlanıldı ✓"
                  : "Layihəni tapşırığa saxla"}
            </button>
          )}
          <button
            className="btn-secondary"
            title={terminalOpen ? "Terminalı bağla" : "Terminalı aç"}
            aria-label="Terminal"
            style={{
              width: "auto",
              padding: "5px 8px",
              display: "flex",
              alignItems: "center",
              color: terminalOpen ? "var(--accent)" : undefined,
            }}
            onClick={() => setTerminalOpen((o) => !o)}
          >
            <SquareTerminal size={15} />
          </button>
          <button
            className="btn-secondary"
            style={{ width: "auto", padding: "5px 12px", fontSize: 12 }}
            onClick={() => window.close()}
          >
            Bağla
          </button>
        </div>
      </div>

      {saveState === "error" && saveError && (
        <div className="form-error" style={{ margin: "8px 16px 0" }}>
          Layihə tapşırığa saxlanıla bilmədi: {saveError}
        </div>
      )}

      {liveError && (
        <div className="form-error" style={{ margin: "8px 16px 0" }}>
          {liveError}
        </div>
      )}

      {newProjectOpen && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderBottom: "1px solid var(--border)",
            background: "var(--paper-panel)",
            flexShrink: 0,
          }}
        >
          <button
            className="btn-secondary"
            style={{ width: "auto", padding: "5px 10px", fontSize: 12, flexShrink: 0 }}
            onClick={handlePickNewProjectParent}
          >
            Yer seç
          </button>
          <span
            style={{
              fontSize: 11.5,
              color: "var(--muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 80,
            }}
          >
            {newProjectParent ?? "— yer seçilməyib —"}
          </span>
          <input
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
            placeholder="Layihə qovluğunun adı"
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
            className="btn-primary"
            style={{ width: "auto", padding: "5px 12px", fontSize: 12, flexShrink: 0 }}
            disabled={!newProjectParent || !newProjectName.trim()}
            onClick={handleCreateProject}
          >
            Yarat
          </button>
          <button
            className="btn-secondary"
            style={{ width: "auto", padding: "5px 12px", fontSize: 12, flexShrink: 0 }}
            onClick={() => setNewProjectOpen(false)}
          >
            İmtina
          </button>
        </div>
      )}

      {error && <div className="form-error" style={{ margin: "8px 16px 0" }}>{error}</div>}

      {!projectRoot ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--muted)",
            fontSize: 13,
          }}
        >
          Başlamaq üçün bir layihə qovluğu seçin.
        </div>
      ) : graphMaximized ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 12px",
              borderBottom: "1px solid var(--border)",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Qraf</span>
            <button
              className="btn-secondary"
              title="Kiçilt"
              aria-label="Kiçilt"
              style={{ width: "auto", padding: "4px 8px", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
              onClick={() => setGraphMaximized(false)}
            >
              <Minimize2 size={13} />
              Kiçilt
            </button>
          </div>
          <DependencyGraphPane projectRoot={projectRoot} onOpenFile={handleOpenFile} />
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div
            style={{
              width: sidebarOpen ? sidebarWidth : SIDEBAR_RAIL,
              flexShrink: 0,
              borderRight: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {sidebarOpen ? (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    borderBottom: "1px solid var(--border)",
                    flexShrink: 0,
                  }}
                >
                  {(["files", "graph"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setSidebarTab(tab)}
                      style={{
                        flex: 1,
                        border: "none",
                        background: "transparent",
                        borderBottom: sidebarTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                        color: sidebarTab === tab ? "var(--ink)" : "var(--muted)",
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "8px 0",
                        cursor: "pointer",
                      }}
                    >
                      {tab === "files" ? "Fayllar" : "Qraf"}
                    </button>
                  ))}
                  {sidebarTab === "graph" && (
                    <button
                      title="Böyüt"
                      aria-label="Qrafı böyüt"
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "var(--muted)",
                        padding: "0 8px",
                        display: "flex",
                        alignItems: "center",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                      onClick={() => setGraphMaximized(true)}
                    >
                      <Maximize2 size={13} />
                    </button>
                  )}
                  <button
                    title="Paneli bağla"
                    aria-label="Paneli bağla"
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--muted)",
                      padding: "0 8px",
                      display: "flex",
                      alignItems: "center",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <PanelLeftClose size={14} />
                  </button>
                </div>
                {sidebarTab === "files" ? (
                  <div className="thin-scroll" style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
                    <FileTree key={projectRoot} onOpenFile={handleOpenFile} activeFile={openFilePath} />
                  </div>
                ) : (
                  <DependencyGraphPane projectRoot={projectRoot} onOpenFile={handleOpenFile} />
                )}
              </>
            ) : (
              <button
                title="Paneli aç"
                aria-label="Paneli aç"
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--muted)",
                  padding: "8px 0",
                  display: "flex",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                onClick={() => setSidebarOpen(true)}
              >
                <PanelLeft size={15} />
              </button>
            )}
          </div>

          {sidebarOpen && (
            <div
              onMouseDown={startSidebarResize}
              style={{ width: 5, flexShrink: 0, cursor: "col-resize", background: "transparent" }}
            />
          )}

          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              {imagePreviewUrl && openFilePath ? (
                <ImagePreview dataUrl={imagePreviewUrl} name={openFilePath} />
              ) : (
                <EditorPane
                  filePath={openFilePath}
                  content={content}
                  projectRoot={projectRoot}
                  onChange={(value) => {
                    setContent(value);
                    setDirty(true);
                  }}
                />
              )}
            </div>

            {terminalOpen && (
              <>
                <div
                  onMouseDown={startTerminalResize}
                  style={{
                    height: 5,
                    flexShrink: 0,
                    cursor: "row-resize",
                    borderTop: "1px solid var(--border)",
                  }}
                />
                <div
                  style={{
                    height: terminalCollapsed ? TERMINAL_HEADER_H : terminalHeight,
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    background: "#0a0e14",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: TERMINAL_HEADER_H,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0 8px",
                      borderBottom: terminalCollapsed ? "none" : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: "#e6edf3" }}>Terminal</span>
                      {window.ideAPI!.platform === "win32" && (
                        <select
                          value={terminalShell}
                          onChange={(e) => setTerminalShell(e.target.value as "powershell" | "cmd")}
                          style={{
                            fontSize: 11,
                            background: "#131a24",
                            color: "#e6edf3",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 5,
                            padding: "2px 5px",
                          }}
                        >
                          <option value="powershell">PowerShell</option>
                          <option value="cmd">Command Prompt</option>
                        </select>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button
                        title={terminalCollapsed ? "Böyüt" : "Kiçilt"}
                        aria-label={terminalCollapsed ? "Terminalı böyüt" : "Terminalı kiçilt"}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#9aa4b2",
                          padding: 3,
                          display: "flex",
                          cursor: "pointer",
                        }}
                        onClick={() => setTerminalCollapsed((c) => !c)}
                      >
                        {terminalCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      <button
                        title="Bağla"
                        aria-label="Terminalı bağla"
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#9aa4b2",
                          padding: 3,
                          display: "flex",
                          cursor: "pointer",
                        }}
                        onClick={() => setTerminalOpen(false)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  {!terminalCollapsed && (
                    <div style={{ flex: 1, minHeight: 0 }}>
                      <TerminalPane key={`${projectRoot}-${terminalShell}`} cwd={projectRoot} shell={terminalShell} />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
