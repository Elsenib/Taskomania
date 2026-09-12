import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import "./monacoSetup";
import { attachLanguageServer, downloadHeavyServer, type HeavyServerKey } from "./lsp/lspManager";
import { recordContentChange } from "./codeOriginTracker";

const EXT_LANGUAGE: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  json: "json",
  html: "html",
  css: "css",
  scss: "scss",
  less: "less",
  md: "markdown",
  py: "python",
  cs: "csharp",
  java: "java",
  sql: "sql",
  yml: "yaml",
  yaml: "yaml",
  sh: "shell",
  ps1: "powershell",
  xml: "xml",
};

function languageFor(relPath: string): string {
  const ext = relPath.split(".").pop()?.toLowerCase() ?? "";
  return EXT_LANGUAGE[ext] ?? "plaintext";
}

const HEAVY_SERVER_LABEL: Record<HeavyServerKey, string> = {
  csharp: "C#",
  java: "Java",
};

interface Props {
  filePath: string | null;
  content: string;
  onChange: (value: string) => void;
  projectRoot: string;
}

type DownloadPrompt =
  | { serverKey: HeavyServerKey; phase: "confirm" }
  | { serverKey: HeavyServerKey; phase: "downloading"; percent: number }
  | { serverKey: HeavyServerKey; phase: "failed"; message: string };

// One instance per open file (see key={filePath} below) — its useEffect
// cleanup is what reliably fires attachLanguageServer's disposer (didClose +
// unhook the model listener) when the file is switched or closed, since
// @monaco-editor/react's onMount alone gives no unmount callback.
function EditorInstance({ filePath, content, onChange, projectRoot }: Props & { filePath: string }) {
  const disposeRef = useRef<() => void>(() => {});
  const originSubRef = useRef<{ dispose: () => void } | null>(null);
  const editorApiRef = useRef<{ editor: Monaco.editor.IStandaloneCodeEditor; monaco: typeof Monaco } | null>(
    null
  );
  const [prompt, setPrompt] = useState<DownloadPrompt | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      disposeRef.current();
      originSubRef.current?.dispose();
    };
  }, []);

  async function attach() {
    const ref = editorApiRef.current;
    if (!ref) return;
    const model = ref.editor.getModel();
    if (!model) return;
    setAttachError(null);
    const absPath = `${projectRoot.replace(/\\/g, "/")}/${filePath}`;
    const result = await attachLanguageServer(ref.monaco, model, languageFor(filePath), projectRoot, absPath);
    if (result.status === "attached") {
      disposeRef.current = result.dispose;
    } else if (result.status === "needs-download") {
      setPrompt({ serverKey: result.serverKey, phase: "confirm" });
    } else if (result.status === "error") {
      setAttachError(result.message);
    }
  }

  async function handleDownload(serverKey: HeavyServerKey) {
    setPrompt({ serverKey, phase: "downloading", percent: 0 });
    try {
      await downloadHeavyServer(serverKey, (received, total) => {
        setPrompt({ serverKey, phase: "downloading", percent: total > 0 ? Math.round((received / total) * 100) : 0 });
      });
      setPrompt(null);
      attach();
    } catch (err) {
      setPrompt({ serverKey, phase: "failed", message: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {prompt && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 14px",
            borderBottom: "1px solid var(--border)",
            background: "var(--paper-panel)",
            fontSize: 12.5,
            flexShrink: 0,
          }}
        >
          {prompt.phase === "confirm" && (
            <>
              <span style={{ flex: 1 }}>
                {HEAVY_SERVER_LABEL[prompt.serverKey]} dəstəyi (avtomatik tamamlama, xəta vurğulama) üçün dil
                server-i endirilsin? (~50 MB, bir dəfəlik)
              </span>
              <button className="btn-primary" style={{ width: "auto", padding: "4px 12px" }} onClick={() => handleDownload(prompt.serverKey)}>
                Endir
              </button>
              <button className="btn-secondary" style={{ width: "auto", padding: "4px 12px" }} onClick={() => setPrompt(null)}>
                İmtina
              </button>
            </>
          )}
          {prompt.phase === "downloading" && (
            <span style={{ flex: 1 }}>
              {HEAVY_SERVER_LABEL[prompt.serverKey]} server-i endirilir... {prompt.percent}%
            </span>
          )}
          {prompt.phase === "failed" && (
            <>
              <span className="form-error" style={{ flex: 1, margin: 0 }}>
                Endirilə bilmədi: {prompt.message}
              </span>
              <button className="btn-secondary" style={{ width: "auto", padding: "4px 12px" }} onClick={() => setPrompt(null)}>
                Bağla
              </button>
            </>
          )}
        </div>
      )}
      {attachError && (
        <div
          className="form-error"
          style={{ margin: "8px 14px 0", fontSize: 12.5, flexShrink: 0 }}
        >
          Dil serveri qoşula bilmədi: {attachError}
        </div>
      )}
      <Editor
        path={filePath}
        language={languageFor(filePath)}
        value={content}
        theme="vs-dark"
        onChange={(value) => onChange(value ?? "")}
        onMount={(editor, monacoInstance) => {
          editorApiRef.current = { editor, monaco: monacoInstance };
          const model = editor.getModel();
          if (model) {
            originSubRef.current = model.onDidChangeContent((e) => {
              recordContentChange(e.changes, e.isUndoing || e.isRedoing);
            });
          }
          attach();
        }}
        options={{ fontSize: 13, minimap: { enabled: false }, automaticLayout: true }}
      />
    </div>
  );
}

export default function EditorPane({ filePath, content, onChange, projectRoot }: Props) {
  if (!filePath) {
    return (
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
        Redaktə etmək üçün soldan bir fayl seçin.
      </div>
    );
  }

  return (
    <EditorInstance
      // Remounts the editor instance on file switch — simpler and more
      // robust for this step than manually juggling Monaco's multi-model
      // API; fine for the file counts a single project session opens.
      key={filePath}
      filePath={filePath}
      content={content}
      onChange={onChange}
      projectRoot={projectRoot}
    />
  );
}
