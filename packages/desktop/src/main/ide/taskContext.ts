import { ipcMain } from "electron";
import { getCurrentProjectRoot } from "./fsHandlers";
import { zipProject, uploadZipAsAttachment, postCodeOriginComment, type CodeOriginStats } from "./taskUpload";

export interface TaskContext {
  taskId: string;
  token: string;
  apiUrl: string;
}

// Module-level, like fsHandlers.ts's projectRoot — there's only ever one
// IDE window, opened either standalone (no task) or "for" a specific task.
// The token lives ONLY here, in the main process, never in the IDE
// window's own renderer (see ideWindow.ts's security comment) — idePreload
// only ever exposes the taskId back to the renderer, never the token.
let currentContext: TaskContext | null = null;

export function setTaskContext(context: TaskContext | null) {
  currentContext = context;
}

export function registerTaskContextHandlers() {
  ipcMain.handle("task:getContext", (): { taskId: string } | null =>
    currentContext ? { taskId: currentContext.taskId } : null
  );

  ipcMain.handle("task:saveProject", async (_event, stats?: CodeOriginStats): Promise<void> => {
    if (!currentContext) throw new Error("Bu IDE bir tapşırıq üçün açılmayıb");
    const root = getCurrentProjectRoot();
    if (!root) throw new Error("Əvvəlcə bir layihə qovluğu seçin");
    const zipPath = await zipProject(root);
    await uploadZipAsAttachment(currentContext.apiUrl, currentContext.token, currentContext.taskId, zipPath);
    if (stats) {
      // Best-effort: the project attachment itself already succeeded by
      // this point, so a comment failure (network blip, etc.) shouldn't
      // be reported as the whole save having failed.
      await postCodeOriginComment(currentContext.apiUrl, currentContext.token, currentContext.taskId, stats).catch(
        () => {}
      );
    }
  });
}
