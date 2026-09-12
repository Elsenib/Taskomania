import { useCallback, useEffect, useState } from "react";
import FileTree from "./FileTree";
import EditorPane from "./EditorPane";
import TerminalPane from "./TerminalPane";
import DependencyGraphPane from "./DependencyGraphPane";
import { getCodeOriginStats } from "./codeOriginTracker";

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
      const fileContent = await window.ideAPI!.readFile(relPath);
      setOpenFilePath(relPath);
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
      ) : (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div
            style={{
              width: 240,
              flexShrink: 0,
              borderRight: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
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
            </div>
            {sidebarTab === "files" ? (
              <div className="thin-scroll" style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
                <FileTree key={projectRoot} onOpenFile={handleOpenFile} activeFile={openFilePath} />
              </div>
            ) : (
              <DependencyGraphPane projectRoot={projectRoot} onOpenFile={handleOpenFile} />
            )}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <EditorPane
                filePath={openFilePath}
                content={content}
                projectRoot={projectRoot}
                onChange={(value) => {
                  setContent(value);
                  setDirty(true);
                }}
              />
            </div>
            <div
              style={{
                height: 240,
                flexShrink: 0,
                borderTop: "1px solid var(--border)",
                background: "#0a0e14",
              }}
            >
              <TerminalPane key={projectRoot} cwd={projectRoot} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
