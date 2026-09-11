// Golden-angle hue spacing gives well-separated, "interesting" colors for
// any number of groups without a hardcoded palette running out or needing
// an external color library. Originally the Graph view's per-member scheme
// (docs/ARCHITECTURE.md), reused for per-project tag colors so both derive
// a stable color purely from a group's position in its list — no color
// field to store or keep in sync anywhere.
export function groupColor(index: number): string {
  return `hsl(${(index * 137.508) % 360}, 62%, 58%)`;
}
