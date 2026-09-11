// Resolved display info for a task's project tag — name plus the color
// derived from its position in the team's project list (see lib/color.ts).
// Board computes the id -> tag map once and passes it down to Column/TaskCard
// so those components never need to know about useProjects themselves.
export interface ProjectTag {
  name: string;
  color: string;
}
