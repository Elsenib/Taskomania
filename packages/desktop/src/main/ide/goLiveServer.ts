import { ipcMain, shell } from "electron";
import http from "http";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";

// Bound to 127.0.0.1 only (never 0.0.0.0) — this serves arbitrary files
// from whatever project folder is open, so it must never be reachable from
// the network, only from the same machine's own browser.
const HOST = "127.0.0.1";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

const LIVE_RELOAD_PATH = "/__taskomania_live_reload";
// Injected into every HTML response — a plain EventSource, no client
// library needed (avoids pulling in a `ws` dependency just for this).
const LIVE_RELOAD_SCRIPT = `<script>new EventSource(${JSON.stringify(
  LIVE_RELOAD_PATH
)}).onmessage = () => location.reload();</script>`;

let server: http.Server | null = null;
let watcher: fs.FSWatcher | null = null;
let sseClients: http.ServerResponse[] = [];

function notifyReload() {
  for (const res of sseClients) res.write("data: reload\n\n");
}

async function handleRequest(root: string, req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.url === LIVE_RELOAD_PATH) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write("\n");
    sseClients.push(res);
    req.on("close", () => {
      sseClients = sseClients.filter((c) => c !== res);
    });
    return;
  }

  const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
  let relPath = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  let filePath = path.resolve(root, relPath);

  // Path-containment check, same pattern as fsHandlers.ts's resolveInRoot
  // — a request URL is renderer/network-shaped input, never trust it.
  if (filePath !== path.resolve(root) && !filePath.startsWith(path.resolve(root) + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    let stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
      stat = await fsp.stat(filePath);
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

    if (ext === ".html" || ext === ".htm") {
      const html = await fsp.readFile(filePath, "utf-8");
      const withScript = /<\/body>/i.test(html)
        ? html.replace(/<\/body>/i, `${LIVE_RELOAD_SCRIPT}</body>`)
        : html + LIVE_RELOAD_SCRIPT;
      res.writeHead(200, { "Content-Type": contentType });
      res.end(withScript);
      return;
    }

    res.writeHead(200, { "Content-Type": contentType, "Content-Length": stat.size });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

export function registerGoLiveHandlers() {
  ipcMain.handle(
    "goLive:start",
    async (_event, { root, relPath }: { root: string; relPath: string }): Promise<{ url: string }> => {
      if (server) {
        stopGoLive();
      }

      server = http.createServer((req, res) => {
        handleRequest(root, req, res).catch(() => {
          res.writeHead(500);
          res.end("Internal error");
        });
      });

      const port = await new Promise<number>((resolve, reject) => {
        server!.on("error", reject);
        server!.listen(0, HOST, () => {
          const addr = server!.address();
          resolve(typeof addr === "object" && addr ? addr.port : 0);
        });
      });

      // Debounced: a save can fire several fs events in quick succession
      // (write + rename on some editors/OSes) — one reload, not several.
      let debounceTimer: NodeJS.Timeout | null = null;
      watcher = fs.watch(root, { recursive: true }, () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(notifyReload, 200);
      });

      const url = `http://${HOST}:${port}/${relPath.replace(/\\/g, "/")}`;
      await shell.openExternal(url);
      return { url };
    }
  );

  ipcMain.handle("goLive:stop", (): void => {
    stopGoLive();
  });
}

function stopGoLive() {
  for (const res of sseClients) res.end();
  sseClients = [];
  watcher?.close();
  watcher = null;
  server?.close();
  server = null;
}

export function killGoLiveServer() {
  stopGoLive();
}
