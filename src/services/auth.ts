export type AccountRole = "platform_admin" | "company_admin" | "supervisor" | "agent";

export interface AuthenticatedUser {
  id: string;
  tenantId: string | null;
  name: string;
  email: string;
  role: AccountRole;
  company: { id: string; name: string; slug: string } | null;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = (await response.json().catch(() => null)) as (T & ApiErrorBody) | null;
  if (!response.ok) {
    const code = payload?.error?.code ?? "request_failed";
    const serverMessage = payload?.error?.message;
    const friendlyMessage = code === "whatsapp_admin_only"
      ? "Somente o administrador da empresa pode configurar o WhatsApp."
      : code === "forbidden"
        ? "Esta ação está disponível apenas para perfis autorizados."
        : serverMessage ?? "Não foi possível concluir a solicitação.";
    throw new ApiRequestError(
      response.status,
      code,
      friendlyMessage,
    );
  }
  if (payload === null) throw new ApiRequestError(response.status, "invalid_response", "A API retornou uma resposta inválida.");
  return payload;
}

export async function loadSession(): Promise<AuthenticatedUser | null> {
  const response = await apiRequest<{ user: AuthenticatedUser | null }>("/api/auth/me");
  return response.user;
}
