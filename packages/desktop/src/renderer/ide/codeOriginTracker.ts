// Approximate, honest metric — deliberately NOT "AI-generated" detection.
// No tool can reliably claim a piece of code was written by AI vs a human
// (both can produce either style), so this doesn't try to. It measures
// something real and verifiable instead: did this text arrive keystroke by
// keystroke, or as one large block dropped in at once (paste — from an AI
// chat, from StackOverflow, from the user's own notes, doesn't matter which).
// A human who pastes shows up as "pasted" too. This is "how", not "who".
const PASTE_THRESHOLD_CHARS = 20;

let typedChars = 0;
let pastedChars = 0;

interface ContentChange {
  text: string;
}

// Called from EditorPane's onDidChangeContent listener for every open file
// in the current IDE session — module-level (not per-file) because the
// stats are reported in aggregate for the whole project at save time.
export function recordContentChange(changes: readonly ContentChange[], isUndoOrRedo: boolean): void {
  if (isUndoOrRedo) return; // restoring prior text isn't new authorship
  for (const change of changes) {
    const len = change.text.length;
    if (len === 0) continue; // pure deletion — nothing was authored
    if (len > PASTE_THRESHOLD_CHARS) pastedChars += len;
    else typedChars += len;
  }
}

export interface CodeOriginStats {
  typedChars: number;
  pastedChars: number;
  typedPercent: number;
  pastedPercent: number;
}

export function getCodeOriginStats(): CodeOriginStats {
  const total = typedChars + pastedChars;
  return {
    typedChars,
    pastedChars,
    typedPercent: total > 0 ? Math.round((typedChars / total) * 100) : 100,
    pastedPercent: total > 0 ? Math.round((pastedChars / total) * 100) : 0,
  };
}
