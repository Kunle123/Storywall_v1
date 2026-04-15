import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const TOKEN_KEY = "storywall_creator_token";
const CREATOR_KEY = "storywall_creator_profile";

export interface CreatorProfile {
  id: string;
  email: string;
  display_name: string | null;
}

type AuthContextValue = {
  token: string | null;
  creator: CreatorProfile | null;
  setSession: (token: string, creator: CreatorProfile) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): { token: string; creator: CreatorProfile } | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(CREATOR_KEY);
    if (!token || !raw) return null;
    return { token, creator: JSON.parse(raw) as CreatorProfile };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStoredSession()?.token ?? null);
  const [creator, setCreator] = useState<CreatorProfile | null>(() => readStoredSession()?.creator ?? null);

  const setSession = useCallback((t: string, c: CreatorProfile) => {
    setToken(t);
    setCreator(c);
    try {
      localStorage.setItem(TOKEN_KEY, t);
      localStorage.setItem(CREATOR_KEY, JSON.stringify(c));
    } catch {
      /* ignore */
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setCreator(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(CREATOR_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ token, creator, setSession, logout }),
    [token, creator, setSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
