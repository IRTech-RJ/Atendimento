import { ApiError } from "./errors";
import type { AuthenticatedUser } from "./security";

export interface WorkerEnv {
  DB: D1Database;
  MEDIA: R2Bucket;
  APP_ENV: string;
  BOOTSTRAP_ADMIN_KEY?: string;
  DATA_ENCRYPTION_KEY?: string;
  WHATSAPP_APP_SECRET?: string;
  WHATSAPP_DATA_ENCRYPTION_KEY?: string;
  WHATSAPP_GRAPH_VERSION?: string;
}

export async function requirePlatformAdmin(user: AuthenticatedUser): Promise<void> {
  if (user.role !== "platform_admin") {
    throw new ApiError(403, "forbidden", "Esta operação é exclusiva da administração IR Tech.");
  }
}

export async function requireTenantAccess(
  db: D1Database,
  user: AuthenticatedUser,
  tenantId: string,
): Promise<void> {
  const company = await db
    .prepare("SELECT id, status, deleted_at FROM companies WHERE id = ? LIMIT 1")
    .bind(tenantId)
    .first<{ id: string; status: string; deleted_at: string | null }>();

  if (!company || company.deleted_at) {
    throw new ApiError(404, "not_found", "Empresa não encontrada.");
  }

  if (user.role !== "platform_admin" && user.tenantId !== tenantId) {
    throw new ApiError(404, "not_found", "Empresa não encontrada.");
  }

  if (company.status !== "active" && user.role !== "platform_admin") {
    throw new ApiError(403, "company_unavailable", "O ambiente desta empresa está indisponível.");
  }
}

export async function isCompanyTrialExpired(db: D1Database, tenantId: string): Promise<boolean> {
  const company = await db
    .prepare("SELECT trial_ends_at FROM companies WHERE id = ? LIMIT 1")
    .bind(tenantId)
    .first<{ trial_ends_at: string | null }>();
  if (!company?.trial_ends_at) return false;

  const trialEnd = Date.parse(company.trial_ends_at);
  if (!Number.isFinite(trialEnd)) {
    throw new ApiError(500, "invalid_trial_date", "A data de término do período de teste é inválida.");
  }
  return trialEnd <= Date.now();
}

export async function requireTrialWriteAccess(db: D1Database, tenantId: string): Promise<void> {
  if (await isCompanyTrialExpired(db, tenantId)) {
    throw new ApiError(403, "trial_expired", "O período de teste terminou. O ambiente está disponível somente para consulta.");
  }
}

export async function requirePermission(
  db: D1Database,
  user: AuthenticatedUser,
  tenantId: string,
  permissionId: string,
): Promise<void> {
  if (user.role === "platform_admin") return;

  const result = await db
    .prepare(
      `SELECT COALESCE(up.allowed, rp.permission_id IS NOT NULL, 0) AS allowed
       FROM permissions p
       LEFT JOIN role_permissions rp
         ON rp.permission_id = p.id AND rp.role_id = ?
       LEFT JOIN user_permissions up
         ON up.permission_id = p.id AND up.user_id = ? AND up.tenant_id = ?
       WHERE p.id = ?
       LIMIT 1`,
    )
    .bind(user.role, user.id, tenantId, permissionId)
    .first<{ allowed: number }>();

  if (!result?.allowed) {
    throw new ApiError(403, "forbidden", "Você não tem permissão para esta operação.");
  }
}

export async function requireDepartmentAccess(
  db: D1Database,
  user: AuthenticatedUser,
  tenantId: string,
  departmentId: string,
  permission: "can_view_conversations" | "can_reply" | "can_manage_users" = "can_view_conversations",
): Promise<void> {
  if (user.role === "platform_admin" || user.role === "company_admin") return;

  const membership = await db
    .prepare(
      `SELECT 1 AS allowed
       FROM user_departments ud
       JOIN departments d ON d.id = ud.department_id AND d.tenant_id = ud.tenant_id
       WHERE ud.tenant_id = ? AND ud.user_id = ? AND ud.department_id = ?
         AND ud.${permission} = 1 AND d.status = 'active' AND d.deleted_at IS NULL
       LIMIT 1`,
    )
    .bind(tenantId, user.id, departmentId)
    .first<{ allowed: number }>();

  if (!membership) throw new ApiError(404, "not_found", "Registro não encontrado.");
}

export async function assertConversationAccess(
  db: D1Database,
  user: AuthenticatedUser,
  tenantId: string,
  conversationId: string,
  permissionId: string,
): Promise<{ id: string; department_id: string }> {
  await requirePermission(db, user, tenantId, permissionId);
  const conversation = await db
    .prepare(
      `SELECT id, department_id FROM conversations
       WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL LIMIT 1`,
    )
    .bind(tenantId, conversationId)
    .first<{ id: string; department_id: string }>();

  if (!conversation) throw new ApiError(404, "not_found", "Conversa não encontrada.");
  await requireDepartmentAccess(db, user, tenantId, conversation.department_id);
  return conversation;
}
