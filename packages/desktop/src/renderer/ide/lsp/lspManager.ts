import type * as Monaco from "monaco-editor";
import { LspClient } from "./LspClient";

type ServerKey = "typescript" | "python" | "sql" | "csharp" | "java";
export type HeavyServerKey = "csharp" | "java";
const HEAVY_SERVERS = new Set<ServerKey>(["csharp", "java"]);

// typescript-language-server serves both .ts and .js out of one process
// (same as VS Code's own tsserver) — no need for two separate sessions.
function serverKeyForMonacoLanguage(lang: string): ServerKey | null {
  switch (lang) {
    case "typescript":
    case "javascript":
      return "typescript";
    case "python":
      return "python";
    case "sql":
      return "sql";
    case "csharp":
      return "csharp";
    case "java":
      return "java";
    default:
      return null;
  }
}

// C#/Java servers are downloaded on first use rather than bundled (see
// main/ide/lspDownloader.ts) — wraps the download call + its progress
// event into a single promise for callers that just want a done signal.
export function downloadHeavyServer(
  serverKey: HeavyServerKey,
  onProgress: (receivedBytes: number, totalBytes: number) => void
): Promise<void> {
  const unsubscribe = window.ideAPI!.onLspDownloadProgress((payload) => {
    if (payload.languageId === serverKey) onProgress(payload.receivedBytes, payload.totalBytes);
  });
  return window.ideAPI!.lspDownloadServer(serverKey).finally(unsubscribe);
}

// Different servers normalize file:// URIs differently even for the same
// path — typescript-language-server (via vscode-uri) percent-encodes the
// drive-letter colon ("file:///c%3A/..."), while OmniSharp lowercases the
// drive letter but leaves the colon literal ("file:///c:/..."). Comparing
// raw strings (as toFileUri produces) breaks the moment a second server
// with a third convention shows up, so every URI comparison decodes +
// lowercases first — that's the one thing every convention agrees on
// after normalization.
function normalizeUriForCompare(uri: string): string {
  try {
    return decodeURIComponent(uri).toLowerCase();
  } catch {
    return uri.toLowerCase();
  }
}

function toFileUri(absPath: string): string {
  const posix = absPath.replace(/\\/g, "/");
  const withSlash = posix.startsWith("/") ? posix : "/" + posix;
  // Windows drive paths must match vscode-uri's normalization (lowercase
  // drive letter, colon percent-encoded as %3A) — that's what
  // typescript-language-server/pyright/sql-language-server echo back in
  // publishDiagnostics, since they build URIs with vscode-uri internally.
  // Without this, our own computed uri strings never equal the ones
  // servers send back, so applyDiagnostics's lookup always misses and
  // markers silently never apply, even though the notification itself
  // arrives correctly.
  const driveMatch = /^\/([A-Za-z]):(.*)$/.exec(withSlash);
  if (driveMatch) {
    const [, drive, rest] = driveMatch;
    return `file:///${drive.toLowerCase()}%3A${encodeURI(rest)}`;
  }
  return "file://" + encodeURI(withSlash);
}

interface DocEntry {
  client: LspClient;
  uri: string;
  version: number;
  model: Monaco.editor.ITextModel;
}

// The IDE only ever has one project open at a time (see IdeApp's single
// projectRoot state) — sessions are keyed by server, restarted wholesale if
// the project root changes, rather than trying to juggle multiple projects.
const clients = new Map<ServerKey, Promise<LspClient>>();
let activeProjectRoot: string | null = null;
const docs = new Map<string, DocEntry>();
const providersRegistered = new Set<string>();
let monacoRef: typeof Monaco | null = null;

function resetForNewProject(projectRoot: string) {
  if (activeProjectRoot === projectRoot) return;
  for (const pending of clients.values()) {
    pending.then((c) => c.dispose()).catch(() => {});
  }
  clients.clear();
  docs.clear();
  activeProjectRoot = projectRoot;
}

async function getClient(serverKey: ServerKey, projectRoot: string): Promise<LspClient> {
  resetForNewProject(projectRoot);
  let pending = clients.get(serverKey);
  if (!pending) {
    pending = (async () => {
      const client = await LspClient.start(serverKey, projectRoot);
      const rootUri = toFileUri(projectRoot);
      await client.sendRequest("initialize", {
        processId: null,
        rootUri,
        workspaceFolders: [{ uri: rootUri, name: "project" }],
        capabilities: {
          textDocument: {
            synchronization: { didSave: true, dynamicRegistration: false },
            completion: { completionItem: { snippetSupport: false }, dynamicRegistration: false },
            hover: { contentFormat: ["plaintext", "markdown"], dynamicRegistration: false },
            publishDiagnostics: { relatedInformation: true },
            definition: { dynamicRegistration: false },
          },
        },
      });
      client.sendNotification("initialized", {});
      client.onNotification("textDocument/publishDiagnostics", (params) => {
        applyDiagnostics(params as { uri: string; diagnostics: LspDiagnostic[] });
      });
      return client;
    })();
    clients.set(serverKey, pending);
  }
  return pending;
}

interface LspDiagnostic {
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  message: string;
  severity?: number;
  source?: string;
}

function applyDiagnostics(params: { uri: string; diagnostics: LspDiagnostic[] }) {
  if (!monacoRef) return;
  const targetUri = normalizeUriForCompare(params.uri);
  for (const entry of docs.values()) {
    if (normalizeUriForCompare(entry.uri) !== targetUri) continue;
    const markers = params.diagnostics.map((d) => ({
      severity: lspSeverityToMonaco(monacoRef!, d.severity),
      startLineNumber: d.range.start.line + 1,
      startColumn: d.range.start.character + 1,
      endLineNumber: d.range.end.line + 1,
      endColumn: d.range.end.character + 1,
      message: d.message,
      source: d.source,
    }));
    monacoRef.editor.setModelMarkers(entry.model, "lsp", markers);
  }
}

function lspSeverityToMonaco(m: typeof Monaco, severity?: number) {
  switch (severity) {
    case 1:
      return m.MarkerSeverity.Error;
    case 2:
      return m.MarkerSeverity.Warning;
    case 3:
      return m.MarkerSeverity.Info;
    default:
      return m.MarkerSeverity.Hint;
  }
}

function lspKindToMonaco(m: typeof Monaco, kind?: number): Monaco.languages.CompletionItemKind {
  const K = m.languages.CompletionItemKind;
  const map: Record<number, Monaco.languages.CompletionItemKind> = {
    1: K.Text, 2: K.Method, 3: K.Function, 4: K.Constructor, 5: K.Field, 6: K.Variable,
    7: K.Class, 8: K.Interface, 9: K.Module, 10: K.Property, 11: K.Unit, 12: K.Value,
    13: K.Enum, 14: K.Keyword, 15: K.Snippet, 16: K.Color, 17: K.File, 18: K.Reference,
    19: K.Folder, 20: K.EnumMember, 21: K.Constant, 22: K.Struct, 23: K.Event,
    24: K.Operator, 25: K.TypeParameter,
  };
  return kind !== undefined && map[kind] !== undefined ? map[kind] : K.Text;
}

function rangeFromLsp(r: LspDiagnostic["range"]) {
  return {
    startLineNumber: r.start.line + 1,
    startColumn: r.start.character + 1,
    endLineNumber: r.end.line + 1,
    endColumn: r.end.character + 1,
  };
}

function registerProviders(m: typeof Monaco, monacoLanguage: string) {
  if (providersRegistered.has(monacoLanguage)) return;
  providersRegistered.add(monacoLanguage);

  m.languages.registerCompletionItemProvider(monacoLanguage, {
    triggerCharacters: [".", '"', "'", "/", "@", "<"],
    provideCompletionItems: async (model, position) => {
      const entry = docs.get(model.uri.toString());
      if (!entry) return { suggestions: [] };
      let result: { items?: unknown[] } | unknown[] | null;
      try {
        result = await entry.client.sendRequest("textDocument/completion", {
          textDocument: { uri: entry.uri },
          position: { line: position.lineNumber - 1, character: position.column - 1 },
        });
      } catch {
        return { suggestions: [] };
      }
      const items = (Array.isArray(result) ? result : (result as { items?: unknown[] })?.items ?? []) as Array<{
        label: string;
        kind?: number;
        insertText?: string;
        detail?: string;
        documentation?: string | { value: string };
      }>;
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      return {
        suggestions: items.map((item) => ({
          label: item.label,
          kind: lspKindToMonaco(m, item.kind),
          insertText: item.insertText ?? item.label,
          detail: item.detail,
          documentation:
            typeof item.documentation === "string" ? item.documentation : item.documentation?.value,
          range,
        })),
      };
    },
  });

  m.languages.registerHoverProvider(monacoLanguage, {
    provideHover: async (model, position) => {
      const entry = docs.get(model.uri.toString());
      if (!entry) return null;
      let result: { contents?: unknown } | null;
      try {
        result = await entry.client.sendRequest("textDocument/hover", {
          textDocument: { uri: entry.uri },
          position: { line: position.lineNumber - 1, character: position.column - 1 },
        });
      } catch {
        return null;
      }
      if (!result?.contents) return null;
      const contents = result.contents as string | { value: string } | Array<string | { value: string }>;
      const value = Array.isArray(contents)
        ? contents.map((c) => (typeof c === "string" ? c : c.value)).join("\n\n")
        : typeof contents === "string"
          ? contents
          : contents.value;
      return { contents: [{ value }] };
    },
  });

  m.languages.registerDefinitionProvider(monacoLanguage, {
    provideDefinition: async (model, position) => {
      const entry = docs.get(model.uri.toString());
      if (!entry) return null;
      let result: unknown;
      try {
        result = await entry.client.sendRequest("textDocument/definition", {
          textDocument: { uri: entry.uri },
          position: { line: position.lineNumber - 1, character: position.column - 1 },
        });
      } catch {
        return null;
      }
      const locations = (Array.isArray(result) ? result : result ? [result] : []) as Array<{
        uri?: string;
        targetUri?: string;
        range?: LspDiagnostic["range"];
        targetRange?: LspDiagnostic["range"];
      }>;
      return locations
        .filter((loc) => loc.range ?? loc.targetRange)
        .map((loc) => ({
          uri: m.Uri.parse((loc.uri ?? loc.targetUri)!),
          range: rangeFromLsp((loc.range ?? loc.targetRange)!),
        }));
    },
  });
}

export type AttachResult =
  | { status: "unsupported" }
  | { status: "needs-download"; serverKey: HeavyServerKey }
  | { status: "error"; message: string }
  | { status: "attached"; dispose: () => void };

// Called once per opened file (from EditorPane's onMount) — starts/reuses
// the right server for its language, sends didOpen, and returns a disposer
// that sends didClose + unhooks the model's change listener. The caller is
// responsible for invoking the disposer when that editor instance unmounts
// (file switched/closed).
export async function attachLanguageServer(
  m: typeof Monaco,
  model: Monaco.editor.ITextModel,
  monacoLanguage: string,
  projectRoot: string,
  absPath: string
): Promise<AttachResult> {
  monacoRef = m;
  const serverKey = serverKeyForMonacoLanguage(monacoLanguage);
  if (!serverKey) return { status: "unsupported" };

  if (HEAVY_SERVERS.has(serverKey)) {
    const installed = await window.ideAPI!.lspIsServerInstalled(serverKey as HeavyServerKey);
    if (!installed) return { status: "needs-download", serverKey: serverKey as HeavyServerKey };
  }

  registerProviders(m, monacoLanguage);

  let client: LspClient;
  try {
    client = await getClient(serverKey, projectRoot);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }

  const uri = toFileUri(absPath);
  const modelKey = model.uri.toString();
  docs.set(modelKey, { client, uri, version: 1, model });

  client.sendNotification("textDocument/didOpen", {
    textDocument: { uri, languageId: monacoLanguage, version: 1, text: model.getValue() },
  });

  const changeSub = model.onDidChangeContent(() => {
    const entry = docs.get(modelKey);
    if (!entry) return;
    entry.version += 1;
    client.sendNotification("textDocument/didChange", {
      textDocument: { uri, version: entry.version },
      contentChanges: [{ text: model.getValue() }],
    });
  });

  return {
    status: "attached",
    dispose: () => {
      changeSub.dispose();
      if (docs.has(modelKey)) {
        client.sendNotification("textDocument/didClose", { textDocument: { uri } });
        docs.delete(modelKey);
      }
    },
  };
}
