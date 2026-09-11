import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MyTeam } from "@team-tracker/shared";
import { useAuth } from "../auth/AuthContext";

export function useMyTeams() {
  const { myTeams } = useAuth();
  return useQuery({ queryKey: ["myTeams"], queryFn: myTeams });
}

// Every mutation that changes team membership (create/join/switch/leave)
// should call this afterwards so the switcher's list reflects it immediately.
export function useInvalidateMyTeams() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["myTeams"] });
}
