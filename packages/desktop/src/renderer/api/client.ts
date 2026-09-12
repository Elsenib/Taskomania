export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "team-tracker:token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// AuthContext registers itself here so a 401 from anywhere (token expired,
// revoked, etc.) logs the user out immediately instead of leaving the app
// stuck retrying requests with a dead token.
type UnauthorizedListener = () => void;
let onUnauthorized: UnauthorizedListener | null = null;
export function setUnauthorizedHandler(fn: UnauthorizedListener | null) {
  onUnauthorized = fn;
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        // FormData sets its own multipart Content-Type (with boundary) —
        // setting it manually here would drop the boundary and break upload.
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body:
        options.body === undefined
          ? undefined
          : isFormData
            ? (options.body as FormData)
            : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError("Backend-ə qoşulmaq alınmadı. İnternet/server bağlantısını yoxla.", 0);
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.();
    const message =
      typeof data.error === "string" ? data.error : JSON.stringify(data.error ?? res.statusText);
    throw new ApiError(message, res.status);
  }

  return data as T;
}
