import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import type { AuthResponse, MyTeam, User } from "@team-tracker/shared";
import { apiFetch, ApiError, getToken, setToken, clearToken, setUnauthorizedHandler } from "../api/client";
import { connectSocket, disconnectSocket } from "../api/socket";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  sessionExpired: boolean;
  /** Set when a saved token exists but the initial session check couldn't reach
   * the backend — distinct from "not logged in", so we don't show the login
   * screen for what's actually a connectivity problem. */
  connectionError: string | null;
  retryConnection(): void;
  registerTeam(input: {
    teamName: string;
    displayName: string;
    email: string;
    password: string;
  }): Promise<void>;
  joinTeam(input: {
    inviteCode: string;
    displayName: string;
    email: string;
    password: string;
  }): Promise<void>;
  login(input: { email: string; password: string }): Promise<void>;
  updateProfile(input: {
    displayName?: string;
    avatarUrl?: string | null;
    onboardingSeen?: true;
  }): Promise<void>;
  logout(): void;
  myTeams(): Promise<MyTeam[]>;
  createAdditionalTeam(teamName: string): Promise<void>;
  joinAdditionalTeam(inviteCode: string): Promise<void>;
  switchTeam(teamId: string): Promise<void>;
  leaveTeam(teamId: string): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  // avoids a stale closure over `user` inside the unauthorized handler below
  const hasUserRef = useRef(false);

  function clearSession() {
    clearToken();
    disconnectSocket();
    setUser(null);
  }

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (hasUserRef.current) setSessionExpired(true);
      clearSession();
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    hasUserRef.current = Boolean(user);
  }, [user]);

  const checkSession = useCallback(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setConnectionError(null);
    apiFetch<{ user: User }>("/api/v1/auth/me")
      .then((res) => {
        setUser(res.user);
        connectSocket(token);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          // real rejection — the token is gone/invalid, back to the login screen
          clearToken();
        } else {
          // network/server unreachable — token is still good, don't discard the
          // session over a connectivity blip. Show a retry screen instead.
          setConnectionError(
            err instanceof ApiError ? err.message : "Backend-ə qoşulmaq alınmadı"
          );
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  function applyAuth(res: AuthResponse) {
    setSessionExpired(false);
    setToken(res.token);
    setUser(res.user);
    connectSocket(res.token);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        sessionExpired,
        connectionError,
        retryConnection: checkSession,
        async registerTeam(input) {
          const res = await apiFetch<AuthResponse>("/api/v1/auth/register", {
            method: "POST",
            body: input,
          });
          applyAuth(res);
        },
        async joinTeam(input) {
          const res = await apiFetch<AuthResponse>("/api/v1/auth/join", {
            method: "POST",
            body: input,
          });
          applyAuth(res);
        },
        async login(input) {
          const res = await apiFetch<AuthResponse>("/api/v1/auth/login", {
            method: "POST",
            body: input,
          });
          applyAuth(res);
        },
        async updateProfile(input) {
          const res = await apiFetch<{ user: User }>("/api/v1/auth/me", {
            method: "PATCH",
            body: input,
          });
          setUser(res.user);
        },
        logout() {
          setSessionExpired(false);
          clearSession();
        },
        async myTeams() {
          const res = await apiFetch<{ teams: MyTeam[] }>("/api/v1/auth/my-teams");
          return res.teams;
        },
        async createAdditionalTeam(teamName) {
          const res = await apiFetch<AuthResponse>("/api/v1/auth/teams", {
            method: "POST",
            body: { teamName },
          });
          applyAuth(res);
        },
        async joinAdditionalTeam(inviteCode) {
          const res = await apiFetch<AuthResponse>("/api/v1/auth/teams/join", {
            method: "POST",
            body: { inviteCode },
          });
          applyAuth(res);
        },
        async switchTeam(teamId) {
          const res = await apiFetch<AuthResponse>("/api/v1/auth/switch-team", {
            method: "POST",
            body: { teamId },
          });
          applyAuth(res);
        },
        async leaveTeam(teamId) {
          const res = await apiFetch<AuthResponse>("/api/v1/auth/leave-team", {
            method: "POST",
            body: { teamId },
          });
          applyAuth(res);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
