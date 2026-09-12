import type { Role } from "@team-tracker/shared";
import type { TranslationKey } from "../i18n/translations";

// Used everywhere a member's role is shown as text (App.tsx, TeamSwitcher,
// ProfileScreen) — one place for the 3-way mapping so a future role change
// only needs updating here instead of at each call site.
export function roleLabel(role: Role, t: (key: TranslationKey) => string): string {
  if (role === "ADMIN") return t("common.roleAdmin");
  if (role === "MENTOR") return t("common.roleMentor");
  return t("common.roleMember");
}
