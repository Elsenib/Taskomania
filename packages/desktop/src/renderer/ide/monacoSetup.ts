// Wires @monaco-editor/react to the LOCALLY bundled monaco-editor package
// instead of its default behaviour of fetching Monaco from a CDN at runtime
// — this is an offline-capable desktop app, and a CDN fetch would also be
// blocked by CSP's connect-src allowlist anyway. Vite's `?worker` imports
// give each language service its own real Worker (needs `worker-src 'self'
// blob:` in the CSP — see index.html).
import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";
import {
  typescriptDefaults,
  javascriptDefaults,
  type ModeConfiguration,
} from "monaco-editor/languages/features/typescript/register.js";
import { emmetHTML, emmetCSS, emmetJSX } from "emmet-monaco-es";
import editorWorker from "monaco-editor/editor/editor.worker.js?worker";
import jsonWorker from "monaco-editor/language/json/json.worker.js?worker";
import cssWorker from "monaco-editor/language/css/css.worker.js?worker";
import htmlWorker from "monaco-editor/language/html/html.worker.js?worker";
import tsWorker from "monaco-editor/language/typescript/ts.worker.js?worker";

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === "json") return new jsonWorker();
    if (label === "css" || label === "scss" || label === "less") return new cssWorker();
    if (label === "html" || label === "handlebars" || label === "razor") return new htmlWorker();
    if (label === "typescript" || label === "javascript") return new tsWorker();
    return new editorWorker();
  },
};

loader.config({ monaco });

// Monaco bundles its own built-in TypeScript/JavaScript language service
// (completion/hover/diagnostics/definitions) alongside the ts.worker used
// above purely for tokenizing/syntax highlighting. Once lsp/lspManager.ts
// registers the real typescript-language-server-backed providers for the
// same language ids, Monaco's built-in ones would otherwise fire too —
// duplicate entries in the completion popup, doubled-up diagnostics. Turn
// off everything except the parts still needed (formatting stays on Monaco
// since the LSP bridge doesn't wire textDocument/formatting).
const tsModeConfig: ModeConfiguration = {
  completionItems: false,
  hovers: false,
  documentSymbols: false,
  definitions: false,
  references: false,
  documentHighlights: false,
  rename: false,
  diagnostics: false,
  codeActions: false,
  inlayHints: false,
};
typescriptDefaults.setModeConfiguration(tsModeConfig);
javascriptDefaults.setModeConfiguration(tsModeConfig);

// "!" + Tab/Enter → full HTML boilerplate, "div.class#id" → expanded tag,
// etc. — the same Emmet abbreviation engine VS Code ships with. Registered
// once at module load (like the workers above), independent of which
// files/languages end up open.
emmetHTML(monaco, ["html"]);
emmetCSS(monaco, ["css", "scss", "less"]);
emmetJSX(monaco, ["javascript", "typescript"]);
