import { ipcMain } from "electron";
import { getCurrentProjectRoot } from "./fsHandlers";
import { zipProject, uploadZipAsAttachment, postCodeOriginComment, type CodeOriginStats } from "./taskUpload";

// Every IDE window now carries this, not just task-scoped sessions —
// team chat (chatHandlers.ts) needs the token/apiUrl/teamId/userId
// regardless of whether the IDE was opened "for" a task. taskId stays
// optional: only set when opened from a task's "Daxili IDE" choice.
export interface IdeSessionContext {
  token: string;
  apiUrl: string;
  teamId: string;
  userId: string;
  taskId?: string;
}

// Module-level, like fsHandlers.ts's projectRoot — there's only ever one
// IDE window. The token lives ONLY here, in the main process, never in the
// IDE window's own renderer (see ideWindow.ts's security comment) —
// idePreload only ever exposes plain data (taskId, chat messages, etc.)
// back to the renderer, never the token itself.
let currentContext: IdeSessionContext | null = null;

export function setTaskContext(context: IdeSessionContext | null) {
  currentContext = context;
}

export function getIdeSessionContext(): IdeSessionContext | null {
  return currentContext;
}

export function registerTaskContextHandlers() {
  ipcMain.handle("task:getContext", (): { taskId: string } | null =>
    currentContext?.taskId ? { taskId: currentContext.taskId } : null
  );

  ipcMain.handle("task:saveProject", async (_event, stats?: CodeOriginStats): Promise<void> => {
    if (!currentContext?.taskId) throw new Error("Bu IDE bir tapşırıq üçün açılmayıb");
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
