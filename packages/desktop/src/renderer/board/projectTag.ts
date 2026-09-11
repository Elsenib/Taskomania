import type { LucideIcon } from "lucide-react";
import {
  Rocket,
  Briefcase,
  Flag,
  Star,
  Target,
  Layers,
  Box,
  Compass,
  Zap,
  Palette,
  Puzzle,
  Anchor,
  Gem,
  Flame,
  Leaf,
  Building2,
} from "lucide-react";

// A curated set of visually distinct icons (lucide-react — same stroke style
// as the app's existing hand-drawn nav icons). Nothing is stored — the icon
// is picked deterministically from the project's own id, so it stays stable
// across reloads without a DB field, but doesn't cycle in the obvious
// creation-order sequence either (indexing by list position made every 17th
// project repeat Rocket->Briefcase->Flag->... in lockstep, which read as
// repetitive rather than "random").
const PROJECT_ICONS: LucideIcon[] = [
  Rocket,
  Briefcase,
  Flag,
  Star,
  Target,
  Layers,
  Box,
  Compass,
  Zap,
  Palette,
  Puzzle,
  Anchor,
  Gem,
  Flame,
  Leaf,
  Building2,
];

// djb2 — small, dependency-free string hash. Only needs to spread ids
// reasonably evenly across the icon array, not be cryptographically sound.
function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return Math.abs(hash);
}

export function projectIcon(projectId: string): LucideIcon {
  return PROJECT_ICONS[hashString(projectId) % PROJECT_ICONS.length];
}

// Resolved display info for a task's project tag — name, the color derived
// from its position in the team's project list (see lib/color.ts), and an
// icon from the same position so a project reads as a distinct little badge
// rather than just a colored dot. Board computes the id -> tag map once and
// passes it down to Column/TaskCard so those components never need to know
// about useProjects themselves.
export interface ProjectTag {
  name: string;
  color: string;
  Icon: LucideIcon;
}
