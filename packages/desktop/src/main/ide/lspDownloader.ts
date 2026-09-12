import { app } from "electron";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import https from "https";
import crypto from "crypto";
import { spawn } from "child_process";

// C#/Java language servers are real, heavy (tens of MB) standalone tools —
// bundling them in the installer would bloat every user's download even
// though most projects aren't C#/Java. Instead they're fetched once, on
// first use, and cached under Electron's own per-user data directory.
export type HeavyLanguageId = "csharp" | "java";

// Pinned so a future OmniSharp release can't silently change asset names
// out from under this code — bump deliberately when needed.
const OMNISHARP_VERSION = "v1.39.15";

// JDT LS has no versioned "latest" release artifact story as clean as
// OmniSharp's — this is Eclipse's own stable "always current" snapshot
// URL, the same one editor plugins (Emacs lsp-mode, various Vim configs)
// rely on. Same file for every platform; only the launch config differs.
const JDT_URL = "https://download.eclipse.org/jdtls/snapshots/jdt-language-server-latest.tar.gz";

interface AssetInfo {
  url: string;
  archiveExt: "zip" | "tar.gz";
}

// Self-contained net6.0 builds are used deliberately (over the plain
// "omnisharp-*.zip" mono/net472 builds) — they bundle the .NET runtime,
// so no separate .NET SDK install is required on the user's machine.
function omnisharpAsset(): AssetInfo | null {
  const base = `https://github.com/OmniSharp/omnisharp-roslyn/releases/download/${OMNISHARP_VERSION}/`;
  const { platform, arch } = process;
  if (platform === "win32") return { url: base + "omnisharp-win-x64-net6.0.zip", archiveExt: "zip" };
  if (platform === "linux" && arch === "arm64")
    return { url: base + "omnisharp-linux-arm64-net6.0.tar.gz", archiveExt: "tar.gz" };
  if (platform === "linux") return { url: base + "omnisharp-linux-x64-net6.0.tar.gz", archiveExt: "tar.gz" };
  if (platform === "darwin" && arch === "arm64")
    return { url: base + "omnisharp-osx-arm64-net6.0.tar.gz", archiveExt: "tar.gz" };
  if (platform === "darwin") return { url: base + "omnisharp-osx-x64-net6.0.tar.gz", archiveExt: "tar.gz" };
  return null;
}

function serverDir(languageId: HeavyLanguageId): string {
  return path.join(app.getPath("userData"), "lsp-servers", languageId);
}

function markerPath(languageId: HeavyLanguageId): string {
  // A dedicated marker (rather than "does the dir exist") means a
  // download that was interrupted partway through isn't mistaken for a
  // successful install on the next launch.
  return path.join(serverDir(languageId), ".installed");
}

export function isServerInstalled(languageId: HeavyLanguageId): boolean {
  return fs.existsSync(markerPath(languageId));
}

function downloadToFile(
  url: string,
  destPath: string,
  onProgress: (receivedBytes: number, totalBytes: number) => void,
  redirectsLeft = 5
): Promise<void> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Taskomania-IDE" } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) return reject(new Error("Too many redirects"));
          downloadToFile(res.headers.location, destPath, onProgress, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }
        const total = parseInt(res.headers["content-length"] || "0", 10);
        let received = 0;
        const fileStream = fs.createWriteStream(destPath);
        res.on("data", (chunk: Buffer) => {
          received += chunk.length;
          onProgress(received, total);
        });
        res.pipe(fileStream);
        fileStream.on("finish", () => fileStream.close(() => resolve()));
        fileStream.on("error", reject);
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

// Shells out to native tools instead of adding a zip/tar npm dependency:
// PowerShell's Expand-Archive (Windows) / unzip (Linux/macOS) for .zip,
// and `tar` for .tar.gz — Windows 10 1803+ ships a real tar.exe (bsdtar)
// in System32, so this one path already covers every platform for the
// JDT LS download, which is tar.gz everywhere.
function extractArchive(archivePath: string, destDir: string, ext: "zip" | "tar.gz"): Promise<void> {
  return new Promise((resolve, reject) => {
    const [command, args] =
      ext === "tar.gz"
        ? (["tar", ["-xzf", archivePath, "-C", destDir]] as const)
        : process.platform === "win32"
          ? ([
              "powershell.exe",
              [
                "-NoProfile",
                "-Command",
                `Expand-Archive -LiteralPath '${archivePath}' -DestinationPath '${destDir}' -Force`,
              ],
            ] as const)
          : (["unzip", ["-o", archivePath, "-d", destDir]] as const);

    const proc = spawn(command, args, { windowsHide: true });
    proc.on("error", reject);
    proc.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`))
    );
  });
}

export async function downloadServer(
  languageId: HeavyLanguageId,
  onProgress: (receivedBytes: number, totalBytes: number) => void
): Promise<void> {
  const dir = serverDir(languageId);
  await fsp.rm(dir, { recursive: true, force: true });
  await fsp.mkdir(dir, { recursive: true });

  const { url, archiveExt } = languageId === "csharp" ? omnisharpAsset() ?? failUnsupported() : { url: JDT_URL, archiveExt: "tar.gz" as const };
  const archivePath = path.join(dir, "download." + archiveExt);
  await downloadToFile(url, archivePath, onProgress);
  await extractArchive(archivePath, dir, archiveExt);
  await fsp.rm(archivePath, { force: true });

  if (languageId === "csharp" && process.platform !== "win32") {
    await fsp.chmod(path.join(dir, "OmniSharp"), 0o755).catch(() => {});
  }

  await fsp.writeFile(markerPath(languageId), new Date().toISOString());
}

function failUnsupported(): never {
  throw new Error("Bu platforma/arxitektura üçün OmniSharp buraxılışı mövcud deyil");
}

export function resolveCsharpCommand(): { command: string; args: string[] } | null {
  const dir = serverDir("csharp");
  const exe = path.join(dir, process.platform === "win32" ? "OmniSharp.exe" : "OmniSharp");
  if (!fs.existsSync(exe)) return null;
  // -lsp switches OmniSharp from its own legacy line-delimited stdio
  // protocol (predates LSP, still the default) into real LSP mode.
  return { command: exe, args: ["-lsp"] };
}

export function resolveJavaCommand(projectRoot: string): { command: string; args: string[] } | null {
  const dir = serverDir("java");
  const pluginsDir = path.join(dir, "plugins");
  if (!fs.existsSync(pluginsDir)) return null;
  const launcherJar = fs
    .readdirSync(pluginsDir)
    .find((f) => f.startsWith("org.eclipse.equinox.launcher_") && f.endsWith(".jar"));
  if (!launcherJar) return null;

  const configDirName =
    process.platform === "win32" ? "config_win" : process.platform === "darwin" ? "config_mac" : "config_linux";
  const configDir = path.join(dir, configDirName);
  // JDT LS requires a dedicated, stable workspace-data directory per
  // project (reusing one across unrelated projects corrupts its index) —
  // hash the project path into a stable, filesystem-safe folder name.
  const workspaceHash = crypto.createHash("md5").update(projectRoot).digest("hex");
  const dataDir = path.join(dir, "workspaces", workspaceHash);

  return {
    command: "java",
    args: [
      "-Declipse.application=org.eclipse.jdt.ls.core.id1",
      "-Dosgi.bundles.defaultStartLevel=4",
      "-Declipse.product=org.eclipse.jdt.ls.core.product",
      "-Dlog.level=ERROR",
      "-Xmx1G",
      "--add-modules=ALL-SYSTEM",
      "--add-opens",
      "java.base/java.util=ALL-UNNAMED",
      "--add-opens",
      "java.base/java.lang=ALL-UNNAMED",
      "-jar",
      path.join(pluginsDir, launcherJar),
      "-configuration",
      configDir,
      "-data",
      dataDir,
    ],
  };
}
