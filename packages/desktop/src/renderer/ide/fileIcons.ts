import {
  File,
  FileCode,
  FileCode2,
  FileJson,
  FileText,
  FileTerminal,
  FileCog,
  FileImage,
  FileArchive,
  FileSpreadsheet,
  Package,
  Database,
  Coffee,
  Folder,
  FolderOpen,
  type LucideIcon,
} from "lucide-react";

interface FileIconSpec {
  Icon: LucideIcon;
  color: string;
}

// Fixed (not hashed) colors per language, matching the well-known
// conventions from VS Code's default/Material icon themes (TS blue, JS
// yellow, Python blue, C# purple, etc.) — recognizability depends on these
// being the SAME color every time, unlike the golden-angle hash used for
// project tags elsewhere in this app.
const DEFAULT_ICON: FileIconSpec = { Icon: File, color: "#8a8a8a" };

const EXT_ICON: Record<string, FileIconSpec> = {
  ts: { Icon: FileCode2, color: "#3178c6" },
  tsx: { Icon: FileCode2, color: "#3178c6" },
  js: { Icon: FileCode2, color: "#d7ba00" },
  jsx: { Icon: FileCode2, color: "#d7ba00" },
  mjs: { Icon: FileCode2, color: "#d7ba00" },
  cjs: { Icon: FileCode2, color: "#d7ba00" },
  json: { Icon: FileJson, color: "#d7ba00" },
  jsonc: { Icon: FileJson, color: "#d7ba00" },
  html: { Icon: FileCode, color: "#e34c26" },
  htm: { Icon: FileCode, color: "#e34c26" },
  css: { Icon: FileCode, color: "#563d7c" },
  scss: { Icon: FileCode, color: "#c76494" },
  less: { Icon: FileCode, color: "#1d365d" },
  md: { Icon: FileText, color: "#519aba" },
  mdx: { Icon: FileText, color: "#519aba" },
  py: { Icon: FileCode2, color: "#3572a5" },
  cs: { Icon: FileCode2, color: "#68217a" },
  csproj: { Icon: FileCog, color: "#68217a" },
  sln: { Icon: FileCog, color: "#68217a" },
  java: { Icon: Coffee, color: "#b07219" },
  sql: { Icon: Database, color: "#e38c00" },
  yml: { Icon: FileCog, color: "#cb171e" },
  yaml: { Icon: FileCog, color: "#cb171e" },
  sh: { Icon: FileTerminal, color: "#4eaa25" },
  bash: { Icon: FileTerminal, color: "#4eaa25" },
  ps1: { Icon: FileTerminal, color: "#012456" },
  xml: { Icon: FileCode, color: "#e8a33d" },
  env: { Icon: FileCog, color: "#8a8a8a" },
  png: { Icon: FileImage, color: "#a074c4" },
  jpg: { Icon: FileImage, color: "#a074c4" },
  jpeg: { Icon: FileImage, color: "#a074c4" },
  gif: { Icon: FileImage, color: "#a074c4" },
  svg: { Icon: FileImage, color: "#ffb13b" },
  webp: { Icon: FileImage, color: "#a074c4" },
  ico: { Icon: FileImage, color: "#a074c4" },
  zip: { Icon: FileArchive, color: "#8a8a8a" },
  tar: { Icon: FileArchive, color: "#8a8a8a" },
  gz: { Icon: FileArchive, color: "#8a8a8a" },
  csv: { Icon: FileSpreadsheet, color: "#3fa353" },
  txt: { Icon: FileText, color: "#8a8a8a" },
};

// Filenames matched before falling back to extension — package.json etc.
// are recognizable by their whole name, not just ".json".
const NAME_ICON: Record<string, FileIconSpec> = {
  "package.json": { Icon: Package, color: "#e8274b" },
  "package-lock.json": { Icon: Package, color: "#8a8a8a" },
  "tsconfig.json": { Icon: FileCog, color: "#3178c6" },
  "vite.config.ts": { Icon: FileCog, color: "#729b1b" },
  ".gitignore": { Icon: FileCog, color: "#f05033" },
  ".env": { Icon: FileCog, color: "#8a8a8a" },
  "dockerfile": { Icon: FileCog, color: "#0db7ed" },
};

export function iconForFile(name: string): FileIconSpec {
  const lower = name.toLowerCase();
  if (NAME_ICON[lower]) return NAME_ICON[lower];
  const ext = lower.split(".").pop() ?? "";
  return EXT_ICON[ext] ?? DEFAULT_ICON;
}

export const FOLDER_COLOR = "#c09553";
export { Folder, FolderOpen };
