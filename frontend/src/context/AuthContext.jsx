import { createContext, useCallback, useContext, useEffect, useState } from "react";
import client, { apiErrorMessage } from "../api/client";

const AuthContext = createContext(null);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem("cc_token");
    if (!token) {
      // No session to restore, but still worth waking the free-tier
      // backend up now rather than leaving a logged-out visitor's first
      // Log In click to eat the entire cold-start delay by itself.
      // Fire-and-forget: a cheap, side-effect-free ping, errors ignored.
      client.get("/health").catch(() => {});
      setLoading(false);
      return;
    }
    try {
      const { data } = await client.get("/auth/me");
      setUser(data);
    } catch (err) {
      if (err.response?.status === 401) {
        // The token itself was rejected — genuinely signed out.
        localStorage.removeItem("cc_token");
        setUser(null);
      } else {
        // Anything else (network error, timeout, 5xx) is most likely the
        // free-tier backend waking up from sleep, not an invalid session —
        // retry once before giving up. Crucially, don't clear the token on
        // this path: if the retry also fails, a plain page refresh once the
        // backend is actually awake will still restore the session, instead
        // of silently signing the user out on what was really just a slow
        // cold start.
        await wait(4000);
        try {
          const { data } = await client.get("/auth/me");
          setUser(data);
        } catch (retryErr) {
          if (retryErr.response?.status === 401) {
            localStorage.removeItem("cc_token");
          }
          setUser(null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = async (email, password) => {
    const { data } = await client.post("/auth/login", { email, password });
    localStorage.setItem("cc_token", data.access_token);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await client.post("/auth/register", payload);
    localStorage.setItem("cc_token", data.access_token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("cc_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export { apiErrorMessage };
