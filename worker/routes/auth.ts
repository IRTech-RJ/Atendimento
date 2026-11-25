import { ApiError } from "../errors";
import { emailAddress, json, readJson, requiredPassword, requiredString, requireSameOrigin } from "../http";
import type { WorkerEnv } from "../authorization";
import { createSession, currentUser, hashPassword, revokeSession, verifyPassword, verifySecret } from "../security";

interface LoginRow {
  id: string;
  tenant_id: string | null;
  name: string;
  email: string;
  role: "platform_admin" | "company_admin" | "supervisor" | "agent";
  password_hash: string;
}

function safeUser(row: LoginRow, company?: { id: string; name: string; slug: string } | null) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    email: row.email,
    role: row.role,
    company: company ?? null,
  };
}

export async function handleAuthRoutes(request: Request, env: WorkerEnv): Promise<Response | null> {
  const { pathname } = new URL(request.url);

  if (pathname === "/api/setup/status" && request.method === "GET") {
    const result = await env.DB
      .prepare("SELECT EXISTS(SELECT 1 FROM platform_bootstrap WHERE id = 1) AS is_complete")
      .first<{ is_complete: number }>();
    return json({
      bootstrapRequired: !result?.is_complete,
      bootstrapEnabled: Boolean(env.BOOTSTRAP_ADMIN_KEY),
    });
  }

  if (pathname === "/api/setup/platform-admin" && request.method === "POST") {
    requireSameOrigin(request);
    if (!env.BOOTSTRAP_ADMIN_KEY) {
      throw new ApiError(503, "setup_disabled", "Configure BOOTSTRAP_ADMIN_KEY localmente antes do primeiro acesso.");
    }

    const body = await readJson(request);
    const key = requiredString(body, "key", 512);
    if (!verifySecret(key, env.BOOTSTRAP_ADMIN_KEY)) {
      throw new ApiError(401, "invalid_setup_key", "A chave de configuração é inválida.");
    }

    const alreadyInitialized = await env.DB
      .prepare("SELECT id FROM platform_bootstrap WHERE id = 1 LIMIT 1")
      .first<{ id: number }>();
    if (alreadyInitialized) {
      throw new ApiError(409, "already_initialized", "O administrador inicial já foi criado.");
    }

    const id = crypto.randomUUID();
    const name = requiredString(body, "name", 120);
    const email = emailAddress(requiredString(body, "email", 254));
    const passwordHash = await hashPassword(requiredPassword(body));

    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO platform_bootstrap (id, admin_id) VALUES (1, ?)").bind(id),
        env.DB
          .prepare(
            `INSERT INTO users (id, tenant_id, name, email, password_hash, role)
             VALUES (?, NULL, ?, ?, ?, 'platform_admin')`,
          )
          .bind(id, name, email, passwordHash),
      ]);
    } catch (error) {
      const exists = await env.DB
        .prepare("SELECT id FROM platform_bootstrap WHERE id = 1 LIMIT 1")
        .first<{ id: number }>();
      if (exists) throw new ApiError(409, "already_initialized", "O administrador inicial já foi criado.");
      throw error;
    }

    const session = await createSession(env.DB, id, request);
    return json(
      { user: { id, tenantId: null, name, email, role: "platform_admin", company: null } },
      201,
      { "Set-Cookie": session.cookie },
    );
  }

  if (pathname === "/api/auth/login" && request.method === "POST") {
    requireSameOrigin(request);
    const body = await readJson(request);
    const email = emailAddress(requiredString(body, "email", 254));
    const password = requiredPasswordForLogin(body);
    const workspace = requiredString(body, "workspace", 80);
    let row: LoginRow | null;
    let company: { id: string; name: string; slug: string } | null = null;

    if (workspace === "ir-tech") {
      row = await env.DB
        .prepare(
          `SELECT id, tenant_id, name, email, role, password_hash
           FROM users
           WHERE tenant_id IS NULL AND role = 'platform_admin'
             AND email = ? AND status = 'active' AND deleted_at IS NULL
           LIMIT 1`,
        )
        .bind(email)
        .first<LoginRow>();
    } else {
      const tenantUser = await env.DB
        .prepare(
          `SELECT u.id, u.tenant_id, u.name, u.email, u.role, u.password_hash,
                  c.id AS company_id, c.name AS company_name, c.slug AS company_slug
           FROM users u
           JOIN companies c ON c.id = u.tenant_id
           WHERE c.slug = ? AND c.status = 'active' AND c.deleted_at IS NULL
             AND u.email = ? AND u.status = 'active' AND u.deleted_at IS NULL
           LIMIT 1`,
        )
        .bind(workspace, email)
        .first<LoginRow & { company_id: string; company_name: string; company_slug: string }>();
      row = tenantUser;
      if (tenantUser) {
        company = { id: tenantUser.company_id, name: tenantUser.company_name, slug: tenantUser.company_slug };
      }
    }

    if (!row || !(await verifyPassword(password, row.password_hash))) {
      throw new ApiError(401, "invalid_credentials", "E-mail, senha ou empresa inválidos.");
    }

    const session = await createSession(env.DB, row.id, request);
    return json({ user: safeUser(row, company) }, 200, { "Set-Cookie": session.cookie });
  }

  if (pathname === "/api/auth/me" && request.method === "GET") {
    const user = await currentUser(env.DB, request);
    if (!user) return json({ user: null });
    let company: { id: string; name: string; slug: string } | null = null;
    if (user.tenantId) {
      company = await env.DB
        .prepare("SELECT id, name, slug FROM companies WHERE id = ? AND deleted_at IS NULL LIMIT 1")
        .bind(user.tenantId)
        .first<{ id: string; name: string; slug: string }>();
    }
    return json({ user: { ...user, company } });
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    requireSameOrigin(request);
    const cookie = await revokeSession(env.DB, request);
    return json({ ok: true }, 200, { "Set-Cookie": cookie });
  }

  return null;
}

function requiredPasswordForLogin(body: Record<string, unknown>): string {
  const password = body.password;
  if (typeof password !== "string" || password.length === 0 || password.length > 128) {
    throw new ApiError(422, "invalid_password", "Informe uma senha válida.");
  }
  return password;
}
