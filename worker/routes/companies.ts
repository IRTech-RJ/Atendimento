import { requirePermission, requirePlatformAdmin, type WorkerEnv } from "../authorization";
import { ApiError } from "../errors";
import { json, oneOf, optionalString, readJson, requiredId, requiredString, slugFromName } from "../http";
import type { AuthenticatedUser } from "../security";

interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  document: string | null;
  segment: string;
  city: string;
  status: "active" | "blocked";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export async function handleCompanyRoutes(
  request: Request,
  env: WorkerEnv,
  user: AuthenticatedUser,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith("/api/admin/companies")) return null;

  await requirePlatformAdmin(user);
  await requirePermission(env.DB, user, "", "companies.manage");
  const match = path.match(/^\/api\/admin\/companies(?:\/([^/]+)(?:\/(restore))?)?$/);
  if (!match) throw new ApiError(404, "not_found", "Rota não encontrada.");
  const companyId = match[1] ? requiredId(match[1], "empresa") : null;
  const action = match[2] ?? null;

  if (request.method === "GET" && !companyId) {
    const includeDeleted = url.searchParams.get("includeDeleted") === "true";
    const query = includeDeleted
      ? "SELECT * FROM companies ORDER BY created_at DESC LIMIT 200"
      : "SELECT * FROM companies WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 200";
    const result = await env.DB.prepare(query).all<CompanyRow>();
    return json({ companies: result.results });
  }

  if (request.method === "POST" && !companyId) {
    const body = await readJson(request);
    const name = requiredString(body, "name", 120);
    const slug = body.slug === undefined
      ? slugFromName(name)
      : requiredString(body, "slug", 80).toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new ApiError(422, "invalid_slug", "O identificador deve conter apenas letras minúsculas, números e hífens.");
    }

    const id = crypto.randomUUID();
    try {
      await env.DB
        .prepare(
          `INSERT INTO companies (id, name, slug, document, segment, city)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          name,
          slug,
          optionalString(body, "document", 24) || null,
          requiredString(body, "segment", 80),
          requiredString(body, "city", 100),
        )
        .run();
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new ApiError(409, "company_conflict", "Já existe uma empresa com este identificador.");
      }
      throw error;
    }

    const company = await env.DB.prepare("SELECT * FROM companies WHERE id = ?").bind(id).first<CompanyRow>();
    return json({ company }, 201);
  }

  if (companyId && action === "restore" && request.method === "POST") {
    const result = await env.DB
      .prepare("UPDATE companies SET deleted_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL")
      .bind(new Date().toISOString(), companyId)
      .run();
    if (!result.meta.changes) throw new ApiError(404, "not_found", "Empresa excluída não encontrada.");
    const company = await env.DB.prepare("SELECT * FROM companies WHERE id = ?").bind(companyId).first<CompanyRow>();
    return json({ company });
  }

  if (companyId && request.method === "GET" && !action) {
    const company = await env.DB
      .prepare("SELECT * FROM companies WHERE id = ? AND deleted_at IS NULL LIMIT 1")
      .bind(companyId)
      .first<CompanyRow>();
    if (!company) throw new ApiError(404, "not_found", "Empresa não encontrada.");
    return json({ company });
  }

  if (companyId && request.method === "PATCH" && !action) {
    const existing = await env.DB
      .prepare("SELECT id FROM companies WHERE id = ? AND deleted_at IS NULL LIMIT 1")
      .bind(companyId)
      .first<{ id: string }>();
    if (!existing) throw new ApiError(404, "not_found", "Empresa não encontrada.");

    const body = await readJson(request);
    const updates: Array<[string, unknown]> = [];
    if (body.name !== undefined) updates.push(["name", requiredString(body, "name", 120)]);
    if (body.slug !== undefined) {
      const slug = requiredString(body, "slug", 80).toLowerCase();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new ApiError(422, "invalid_slug", "O identificador da empresa não é válido.");
      }
      updates.push(["slug", slug]);
    }
    if (body.document !== undefined) updates.push(["document", optionalString(body, "document", 24) || null]);
    if (body.segment !== undefined) updates.push(["segment", requiredString(body, "segment", 80)]);
    if (body.city !== undefined) updates.push(["city", requiredString(body, "city", 100)]);
    if (body.status !== undefined) updates.push(["status", oneOf(body.status, ["active", "blocked"] as const, "status")]);
    if (!updates.length) throw new ApiError(422, "empty_update", "Informe ao menos um campo para atualizar.");

    const setClause = updates.map(([column]) => `${column} = ?`).join(", ");
    try {
      await env.DB
        .prepare(`UPDATE companies SET ${setClause}, updated_at = ? WHERE id = ? AND deleted_at IS NULL`)
        .bind(...updates.map(([, value]) => value), new Date().toISOString(), companyId)
        .run();
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new ApiError(409, "company_conflict", "Já existe uma empresa com este identificador.");
      }
      throw error;
    }

    const company = await env.DB.prepare("SELECT * FROM companies WHERE id = ?").bind(companyId).first<CompanyRow>();
    return json({ company });
  }

  if (companyId && request.method === "DELETE" && !action) {
    const now = new Date().toISOString();
    const result = await env.DB
      .prepare(
        `UPDATE companies SET deleted_at = ?, status = 'blocked', updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
      )
      .bind(now, now, companyId)
      .run();
    if (!result.meta.changes) throw new ApiError(404, "not_found", "Empresa não encontrada.");

    await env.DB
      .prepare("UPDATE sessions SET revoked_at = ? WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)")
      .bind(now, companyId)
      .run();
    return json({ ok: true, deletedAt: now });
  }

  return null;
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Error && /unique constraint/i.test(error.message);
}
