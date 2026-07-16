import { createContext, useCallback, useContext, useState } from "react";
import { clearSession, getSession, getToken, login as apiLogin, setSession } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSessionState] = useState(() => (getToken() ? getSession() : null));

  const login = useCallback(async (email, password) => {
    const data = await apiLogin(email, password);
    const sess = { role: data.role, employee_id: data.employee_id, name: data.name };
    setSession(data.access_token, sess);
    setSessionState(sess);
    return sess;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSessionState(null);
  }, []);

  return <AuthContext.Provider value={{ session, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
