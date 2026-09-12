// Minimal JSON-RPC 2.0 client over the ideAPI.lspSend/onLspMessage bridge
// (see main/ide/lspHandlers.ts for the Content-Length framing on the other
// side of that bridge). Deliberately hand-rolled instead of pulling in
// vscode-jsonrpc/monaco-languageclient: those expect a full
// @codingame/monaco-vscode-api polyfill environment to be useful, which is
// far more than this project's plain monaco-editor setup needs just to
// drive completion/hover/diagnostics providers.
export class LspClient {
  private sessionId: string;
  private nextRequestId = 1;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();
  private notificationHandlers = new Map<string, ((params: unknown) => void)[]>();
  private unsubMessage: () => void;
  private unsubExit: () => void;
  private disposed = false;

  private constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.unsubMessage = window.ideAPI!.onLspMessage(({ sessionId: sid, message }) => {
      if (sid !== this.sessionId) return;
      this.handleMessage(message as Record<string, unknown>);
    });
    this.unsubExit = window.ideAPI!.onLspExit(({ sessionId: sid }) => {
      if (sid !== this.sessionId) return;
      for (const { reject } of this.pending.values()) reject(new Error("Dil server prosesi bağlandı"));
      this.pending.clear();
    });
  }

  static async start(languageId: string, projectRoot: string): Promise<LspClient> {
    const sessionId = await window.ideAPI!.lspStart(languageId, projectRoot);
    return new LspClient(sessionId);
  }

  private handleMessage(message: Record<string, unknown>) {
    if (message.id !== undefined && (("result" in message) || ("error" in message))) {
      const pending = this.pending.get(message.id as number);
      if (!pending) return;
      this.pending.delete(message.id as number);
      if (message.error) {
        const err = message.error as { message?: string; code?: number } | string;
        const text = typeof err === "string" ? err : (err?.message ?? JSON.stringify(err));
        pending.reject(new Error(text));
      }
      else pending.resolve(message.result);
    } else if (typeof message.method === "string") {
      const handlers = this.notificationHandlers.get(message.method);
      handlers?.forEach((h) => h(message.params));
    }
  }

  sendRequest<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (this.disposed) return Promise.reject(new Error("LSP client disposed"));
    const id = this.nextRequestId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      window.ideAPI!.lspSend(this.sessionId, { jsonrpc: "2.0", id, method, params });
    });
  }

  sendNotification(method: string, params?: unknown): void {
    if (this.disposed) return;
    window.ideAPI!.lspSend(this.sessionId, { jsonrpc: "2.0", method, params });
  }

  onNotification(method: string, handler: (params: unknown) => void): void {
    const list = this.notificationHandlers.get(method) ?? [];
    list.push(handler);
    this.notificationHandlers.set(method, list);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubMessage();
    this.unsubExit();
    window.ideAPI!.lspStop(this.sessionId);
  }
}
