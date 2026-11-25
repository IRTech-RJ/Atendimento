import { useState } from "react";
import { useEffect } from "react";
import { apiRequest, loadSession, type AuthenticatedUser } from "./services/auth";
import { AuthenticatedWorkspace } from "./pages/AuthenticatedWorkspace";
import { LoginPage } from "./pages/LoginPage";
import { Workspace } from "./layouts/Workspace";
import type { WorkspaceMode } from "./types/workspace";

export default function App() {
  const [mode, setMode] = useState<WorkspaceMode | null>(null);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [startupError, setStartupError] = useState("");

  useEffect(() => {
    let active = true;
    loadSession()
      .then((session) => {
        if (active) setUser(session);
      })
      .catch((error: unknown) => {
        if (active) setStartupError(error instanceof Error ? error.message : "Não foi possível verificar a sessão.");
      })
      .finally(() => {
        if (active) setSessionLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function login(credentials: { workspace: string; email: string; password: string }) {
    const response = await apiRequest<{ user: AuthenticatedUser }>("/api/auth/login", {
      method: "POST",
      body: credentials,
    });
    setUser(response.user);
    setMode(null);
  }

  async function bootstrap(details: { key: string; name: string; email: string; password: string }) {
    const response = await apiRequest<{ user: AuthenticatedUser }>("/api/setup/platform-admin", {
      method: "POST",
      body: details,
    });
    setUser(response.user);
    setMode(null);
  }

  async function logout() {
    await apiRequest("/api/auth/logout", { method: "POST", body: {} });
    setUser(null);
    setMode(null);
  }

  if (sessionLoading) {
    return <main className="grid min-h-screen place-items-center text-sm text-slate-500">Verificando sessão…</main>;
  }

  if (user) return <AuthenticatedWorkspace user={user} onLogout={() => void logout()} />;

  if (!mode) {
    return (
      <LoginPage
        onLogin={login}
        onBootstrap={bootstrap}
        onEnterDemo={setMode}
        startupError={startupError}
      />
    );
  }

  return <Workspace mode={mode} onLogout={() => setMode(null)} />;
}
