import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { extOf, isImageFile, isHtmlFile } from "../lib/fileKind";

const MARKDOWN_EXT = new Set(["md", "markdown"]);

const LANGUAGE_BY_EXT: Record<string, string> = {
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  json: "json",
  css: "css",
  scss: "scss",
  py: "python",
  sh: "bash",
  bash: "bash",
  yml: "yaml",
  yaml: "yaml",
  sql: "sql",
  go: "go",
  rs: "rust",
  java: "java",
  c: "c",
  cpp: "cpp",
  h: "c",
  rb: "ruby",
  php: "php",
  xml: "xml",
  txt: "text",
  env: "bash",
};

function useTextContent(url: string, enabled: boolean) {
  return useQuery({
    queryKey: ["file-content", url],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load file");
      return res.text();
    },
    enabled,
  });
}

export default function FilePreview({ url, filename }: { url: string; filename: string }) {
  const ext = extOf(filename);

  if (isHtmlFile(filename)) {
    return (
      <iframe
        src={url}
        title={filename}
        sandbox="allow-scripts"
        style={{ width: "100%", height: "100%", border: "none", background: "white" }}
      />
    );
  }

  if (isImageFile(filename)) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "var(--paper-panel)" }}>
        <img src={url} alt={filename} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
      </div>
    );
  }

  if (MARKDOWN_EXT.has(ext)) {
    return <MarkdownPreview url={url} />;
  }

  if (ext in LANGUAGE_BY_EXT) {
    return <CodePreview url={url} language={LANGUAGE_BY_EXT[ext]} />;
  }

  return (
    <div style={{ padding: 24, color: "var(--muted)", fontSize: 13 }}>
      Bu fayl növü üçün daxili önizləmə yoxdur.{" "}
      <a href={url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
        Sistemdə aç
      </a>
    </div>
  );
}

function MarkdownPreview({ url }: { url: string }) {
  const { data, isLoading, isError } = useTextContent(url, true);
  if (isLoading) return <div style={{ padding: 24, color: "var(--muted)" }}>Yüklənir...</div>;
  if (isError) return <div style={{ padding: 24, color: "var(--priority-high-ink)" }}>Fayl yüklənmədi.</div>;
  return (
    <div style={{ padding: 24, overflowY: "auto", height: "100%", color: "var(--ink)", fontSize: 14, lineHeight: 1.6 }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{data}</ReactMarkdown>
    </div>
  );
}

function CodePreview({ url, language }: { url: string; language: string }) {
  const { data, isLoading, isError } = useTextContent(url, true);
  if (isLoading) return <div style={{ padding: 24, color: "var(--muted)" }}>Yüklənir...</div>;
  if (isError) return <div style={{ padding: 24, color: "var(--priority-high-ink)" }}>Fayl yüklənmədi.</div>;
  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      <SyntaxHighlighter
        language={language}
        style={oneLight}
        showLineNumbers
        customStyle={{ margin: 0, minHeight: "100%", fontSize: 13 }}
      >
        {data ?? ""}
      </SyntaxHighlighter>
    </div>
  );
}
