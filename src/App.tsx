import { useState } from "react";
import { LoginPage } from "./pages/LoginPage";
import { Workspace } from "./layouts/Workspace";
import type { WorkspaceMode } from "./types/workspace";

export default function App() {
  const [mode, setMode] = useState<WorkspaceMode | null>(null);

  if (!mode) return <LoginPage onEnterDemo={setMode} />;

  return <Workspace mode={mode} onLogout={() => setMode(null)} />;
}
