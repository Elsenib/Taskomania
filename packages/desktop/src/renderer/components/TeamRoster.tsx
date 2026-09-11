import type { Role } from "@team-tracker/shared";
import { useTeamMembers } from "../hooks/useTeamMembers";
import Avatar from "./Avatar";

// Everyone's avatar in one strip so any member can jump into anyone else's
// profile from anywhere on the board — click opens ProfileScreen for them.
// Exception: an admin's profile is admin-eyes-only (see stats.service.ts on
// the server, which enforces this too) — a member sees the admin's avatar
// for recognition but it isn't clickable.
export default function TeamRoster({
  teamId,
  viewerRole,
  onSelect,
}: {
  teamId: string;
  viewerRole: Role;
  onSelect: (userId: string) => void;
}) {
  const { data: members } = useTeamMembers(teamId);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {(members ?? []).map((m) => {
        const viewable = viewerRole === "ADMIN" || m.role !== "ADMIN";
        return (
          <button
            key={m.id}
            type="button"
            onClick={viewable ? () => onSelect(m.id) : undefined}
            disabled={!viewable}
            title={m.displayName}
            style={{
              border: "none",
              background: "transparent",
              padding: 2,
              cursor: viewable ? "pointer" : "default",
              display: "flex",
              opacity: viewable ? 1 : 0.6,
            }}
          >
            <Avatar displayName={m.displayName} avatarUrl={m.avatarUrl} size={26} fontSize={11} />
          </button>
        );
      })}
    </div>
  );
}
