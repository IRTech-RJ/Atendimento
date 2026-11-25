import {
  assertConversationAccess,
  isCompanyTrialExpired,
  requireDepartmentAccess,
  requirePermission,
  requireTenantAccess,
  requireTrialWriteAccess,
  type WorkerEnv,
} from "../authorization";
import { ApiError } from "../errors";
import {
  emailAddress,
  json,
  oneOf,
  optionalBoolean,
  optionalString,
  phoneNumber,
  readJson,
  requiredId,
  requiredPassword,
  requiredString,
} from "../http";
import type { AuthenticatedUser } from "../security";
import { hashPassword } from "../security";
import { handleWhatsAppAccountRoutes, sendWhatsAppText } from "./whatsapp";

type D1Mutation = { success: boolean; meta: { changes: number } };

interface DepartmentAssignment {
  departmentId: string;
  canViewConversations: boolean;
  canReply: boolean;
  canManageUsers: boolean;
}

const tenantRoles = ["company_admin", "supervisor", "agent"] as const;
const userStatuses = ["active", "inactive", "blocked"] as const;
const conversationStatuses = ["open", "pending", "resolved", "closed"] as const;

export async function handleTenantRoutes(
  request: Request,
  env: WorkerEnv,
  user: AuthenticatedUser,
): Promise<Response | null> {
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  if (parts[0] !== "api" || parts[1] !== "tenants") return null;

  const tenantId = requiredId(parts[2], "empresa");
  await requireTenantAccess(env.DB, user, tenantId);
  const resource = parts[3];

  if (resource === "trial" && request.method === "GET") {
    const trial = await env.DB
      .prepare("SELECT trial_started_at, trial_ends_at FROM companies WHERE id = ? LIMIT 1")
      .bind(tenantId)
      .first<{ trial_started_at: string | null; trial_ends_at: string | null }>();
    const expired = await isCompanyTrialExpired(env.DB, tenantId);
    const daysRemaining = trial?.trial_ends_at && !expired
      ? Math.max(0, Math.ceil((Date.parse(trial.trial_ends_at) - Date.now()) / 86_400_000))
      : 0;
    return json({
      trial: {
        startedAt: trial?.trial_started_at ?? null,
        endsAt: trial?.trial_ends_at ?? null,
        daysRemaining,
        expired,
      },
    });
  }

  if (request.method !== "GET" && user.role !== "platform_admin") {
    await requireTrialWriteAccess(env.DB, tenantId);
  }

  if (resource === "users") return handleUsers(request, env, user, tenantId, parts.slice(4));
  if (resource === "departments") return handleDepartments(request, env, user, tenantId, parts.slice(4));
  if (resource === "contacts") return handleContacts(request, env, user, tenantId, parts.slice(4));
  if (resource === "conversations") return handleConversations(request, env, user, tenantId, parts.slice(4));
  if (resource === "tags") return handleTags(request, env, user, tenantId, parts.slice(4));
  if (resource === "whatsapp") return handleWhatsAppAccountRoutes(request, env, user, tenantId, parts.slice(4));
  if (resource === "telegram") {
    throw new ApiError(501, "telegram_coming_soon", "A integração com Telegram estará disponível em breve.");
  }

  throw new ApiError(404, "not_found", "Rota não encontrada.");
}

async function handleUsers(
  request: Request,
  env: WorkerEnv,
  user: AuthenticatedUser,
  tenantId: string,
  path: string[],
): Promise<Response> {
  const permission = "company.users.manage";
  await requirePermission(env.DB, user, tenantId, permission);

  if (path.length === 0 && request.method === "GET") {
    const result = await env.DB
      .prepare(
        `SELECT id, tenant_id, name, email, role, status, created_at, updated_at
         FROM users WHERE tenant_id = ? AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT 200`,
      )
      .bind(tenantId)
      .all();
    return json({ users: result.results });
  }

  if (path.length === 0 && request.method === "POST") {
    const body = await readJson(request);
    const id = crypto.randomUUID();
    const name = requiredString(body, "name", 120);
    const email = emailAddress(requiredString(body, "email", 254));
    const role = oneOf(body.role, tenantRoles, "role");
    const passwordHash = await hashPassword(requiredPassword(body));
    const assignments = parseAssignments(body.departments);
    if (role === "agent" && assignments.length === 0) {
      throw new ApiError(422, "department_required", "Associe o atendente a pelo menos um setor.");
    }
    await validateAssignments(env, tenantId, assignments);

    try {
      const statements = [
        env.DB
          .prepare(
            `INSERT INTO users (id, tenant_id, name, email, password_hash, role)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(id, tenantId, name, email, passwordHash, role),
        ...assignments.map((assignment) =>
          env.DB
            .prepare(
              `INSERT INTO user_departments
               (tenant_id, user_id, department_id, can_view_conversations, can_reply, can_manage_users)
               VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              tenantId,
              id,
              assignment.departmentId,
              Number(assignment.canViewConversations),
              Number(assignment.canReply),
              Number(assignment.canManageUsers),
            ),
        ),
      ];
      await env.DB.batch(statements);
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new ApiError(409, "user_conflict", "Já existe um usuário ativo com este e-mail nesta empresa.");
      }
      throw error;
    }

    return json({ user: await getTenantUser(env, tenantId, id) }, 201);
  }

  if (path.length === 1) {
    const userId = requiredId(path[0], "usuário");
    const target = await getTenantUser(env, tenantId, userId);
    if (!target) throw new ApiError(404, "not_found", "Usuário não encontrado.");

    if (request.method === "GET") {
      const assignments = await getUserDepartments(env, tenantId, userId);
      return json({ user: target, departments: assignments });
    }

    if (request.method === "PATCH") {
      const body = await readJson(request);
      const updates: Array<[string, string | null]> = [];
      if (body.name !== undefined) updates.push(["name", requiredString(body, "name", 120)]);
      if (body.email !== undefined) updates.push(["email", emailAddress(requiredString(body, "email", 254))]);
      if (body.role !== undefined) updates.push(["role", oneOf(body.role, tenantRoles, "role")]);
      if (body.status !== undefined) updates.push(["status", oneOf(body.status, userStatuses, "status")]);
      if (body.password !== undefined) updates.push(["password_hash", await hashPassword(requiredPassword(body))]);
      if (body.departments !== undefined) {
        const role = updates.find(([column]) => column === "role")?.[1] ?? target.role;
        const assignments = parseAssignments(body.departments);
        if (role === "agent" && assignments.length === 0) {
          throw new ApiError(422, "department_required", "Associe o atendente a pelo menos um setor.");
        }
        await validateAssignments(env, tenantId, assignments);
        await replaceUserDepartments(env, tenantId, userId, assignments);
      }

      if (!updates.length && body.departments === undefined) {
        throw new ApiError(422, "empty_update", "Informe ao menos um campo para atualizar.");
      }
      if (updates.length) {
        const setClause = updates.map(([column]) => `${column} = ?`).join(", ");
        try {
          await env.DB
            .prepare(
              `UPDATE users SET ${setClause}, updated_at = ?
               WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL`,
            )
            .bind(...updates.map(([, value]) => value), new Date().toISOString(), tenantId, userId)
            .run();
        } catch (error) {
          if (isUniqueConstraint(error)) {
            throw new ApiError(409, "user_conflict", "Já existe um usuário ativo com este e-mail nesta empresa.");
          }
          throw error;
        }
      }
      if (updates.some(([column, value]) => column === "status" && value !== "active")) {
        await env.DB
          .prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL")
          .bind(new Date().toISOString(), userId)
          .run();
      }
      return json({
        user: await getTenantUser(env, tenantId, userId),
        departments: await getUserDepartments(env, tenantId, userId),
      });
    }

    if (request.method === "DELETE") {
      if (userId === user.id) throw new ApiError(409, "cannot_delete_self", "Não é possível excluir logicamente a própria conta.");
      const now = new Date().toISOString();
      const result = await env.DB
        .prepare(
          `UPDATE users SET status = 'inactive', deleted_at = ?, updated_at = ?
           WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL`,
        )
        .bind(now, now, tenantId, userId)
        .run();
      if (!result.meta.changes) throw new ApiError(404, "not_found", "Usuário não encontrado.");
      await env.DB
        .prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL")
        .bind(now, userId)
        .run();
      return json({ ok: true, deletedAt: now });
    }
  }

  if (path.length === 2 && path[1] === "permissions") {
    const userId = requiredId(path[0], "usuário");
    const target = await getTenantUser(env, tenantId, userId);
    if (!target) throw new ApiError(404, "not_found", "Usuário não encontrado.");

    if (request.method === "GET") {
      const result = await env.DB
        .prepare(
          `SELECT up.permission_id AS id, up.allowed
           FROM user_permissions up
           WHERE up.tenant_id = ? AND up.user_id = ? ORDER BY up.permission_id`,
        )
        .bind(tenantId, userId)
        .all();
      return json({ permissions: result.results });
    }

    if (request.method === "PUT") {
      const body = await readJson(request);
      if (!Array.isArray(body.permissions) || body.permissions.length > 50) {
        throw new ApiError(422, "invalid_permissions", "Informe uma lista válida de permissões.");
      }
      const permissions = body.permissions.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          throw new ApiError(422, "invalid_permissions", "Cada permissão deve ter um identificador e um valor permitido.");
        }
        const record = item as Record<string, unknown>;
        const id = requiredString(record, "id", 100);
        if (!id.startsWith("company.")) {
          throw new ApiError(422, "invalid_permissions", "Só é possível alterar permissões da empresa.");
        }
        return { id, allowed: optionalBoolean(record, "allowed", false) };
      });
      if (new Set(permissions.map((item) => item.id)).size !== permissions.length) {
        throw new ApiError(422, "duplicate_permission", "A lista contém permissões duplicadas.");
      }
      for (const permission of permissions) {
        const exists = await env.DB
          .prepare("SELECT id FROM permissions WHERE id = ? LIMIT 1")
          .bind(permission.id)
          .first<{ id: string }>();
        if (!exists) throw new ApiError(422, "unknown_permission", "Uma das permissões informadas não existe.");
      }
      if (userId === user.id && permissions.some((item) => item.id === "company.users.manage" && !item.allowed)) {
        throw new ApiError(409, "cannot_remove_own_access", "Não é possível remover a própria permissão de gestão de usuários.");
      }

      const statements = [
        env.DB.prepare("DELETE FROM user_permissions WHERE tenant_id = ? AND user_id = ?").bind(tenantId, userId),
        ...permissions.map((permission) =>
          env.DB
            .prepare(
              "INSERT INTO user_permissions (tenant_id, user_id, permission_id, allowed) VALUES (?, ?, ?, ?)",
            )
            .bind(tenantId, userId, permission.id, Number(permission.allowed)),
        ),
      ];
      await env.DB.batch(statements);
      return json({ userId, permissions });
    }
  }

  throw new ApiError(405, "method_not_allowed", "Método não permitido para esta rota.");
}

async function handleDepartments(
  request: Request,
  env: WorkerEnv,
  user: AuthenticatedUser,
  tenantId: string,
  path: string[],
): Promise<Response> {
  await requirePermission(env.DB, user, tenantId, "company.departments.manage");

  if (path.length === 0 && request.method === "GET") {
    const result = await env.DB
      .prepare(
        `SELECT id, tenant_id, name, description, status, created_at
         FROM departments WHERE tenant_id = ? AND deleted_at IS NULL
         ORDER BY name LIMIT 200`,
      )
      .bind(tenantId)
      .all();
    return json({ departments: result.results });
  }

  if (path.length === 0 && request.method === "POST") {
    const body = await readJson(request);
    const id = crypto.randomUUID();
    const name = requiredString(body, "name", 80);
    const description = optionalString(body, "description", 500);
    try {
      await env.DB
        .prepare("INSERT INTO departments (id, tenant_id, name, description) VALUES (?, ?, ?, ?)")
        .bind(id, tenantId, name, description)
        .run();
    } catch (error) {
      if (isUniqueConstraint(error)) throw new ApiError(409, "department_conflict", "Este setor já existe nesta empresa.");
      throw error;
    }
    return json({ department: await getDepartment(env, tenantId, id) }, 201);
  }

  if (path.length === 1) {
    const departmentId = requiredId(path[0], "setor");
    const existing = await getDepartment(env, tenantId, departmentId);
    if (!existing) throw new ApiError(404, "not_found", "Setor não encontrado.");

    if (request.method === "PATCH") {
      const body = await readJson(request);
      const updates: Array<[string, unknown]> = [];
      if (body.name !== undefined) updates.push(["name", requiredString(body, "name", 80)]);
      if (body.description !== undefined) updates.push(["description", optionalString(body, "description", 500)]);
      if (body.status !== undefined) updates.push(["status", oneOf(body.status, ["active", "inactive"] as const, "status")]);
      if (!updates.length) throw new ApiError(422, "empty_update", "Informe ao menos um campo para atualizar.");
      const setClause = updates.map(([column]) => `${column} = ?`).join(", ");
      try {
        await env.DB
          .prepare(`UPDATE departments SET ${setClause} WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL`)
          .bind(...updates.map(([, value]) => value), tenantId, departmentId)
          .run();
      } catch (error) {
        if (isUniqueConstraint(error)) throw new ApiError(409, "department_conflict", "Este setor já existe nesta empresa.");
        throw error;
      }
      return json({ department: await getDepartment(env, tenantId, departmentId) });
    }

    if (request.method === "DELETE") {
      const now = new Date().toISOString();
      const result = await env.DB
        .prepare(
          `UPDATE departments SET status = 'inactive', deleted_at = ?
           WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL`,
        )
        .bind(now, tenantId, departmentId)
        .run();
      if (!result.meta.changes) throw new ApiError(404, "not_found", "Setor não encontrado.");
      return json({ ok: true, deletedAt: now });
    }
  }

  throw new ApiError(405, "method_not_allowed", "Método não permitido para esta rota.");
}

async function handleContacts(
  request: Request,
  env: WorkerEnv,
  user: AuthenticatedUser,
  tenantId: string,
  path: string[],
): Promise<Response> {
  if (path.length === 0 && request.method === "GET") {
    await requirePermission(env.DB, user, tenantId, "company.contacts.read");
    const scope = isWideTenantRole(user)
      ? ""
      : `AND EXISTS (
           SELECT 1 FROM conversations cv
           JOIN user_departments ud
             ON ud.tenant_id = cv.tenant_id AND ud.department_id = cv.department_id
           WHERE cv.tenant_id = c.tenant_id AND cv.contact_id = c.id
             AND cv.deleted_at IS NULL AND ud.user_id = ? AND ud.can_view_conversations = 1
         )`;
    const query = `SELECT c.id, c.tenant_id, c.name, c.phone, c.email, c.notes, c.created_at, c.updated_at
                   FROM contacts c
                   WHERE c.tenant_id = ? AND c.deleted_at IS NULL ${scope}
                   ORDER BY c.name LIMIT 200`;
    const statement = env.DB.prepare(query);
    const result = isWideTenantRole(user)
      ? await statement.bind(tenantId).all()
      : await statement.bind(tenantId, user.id).all();
    return json({ contacts: result.results });
  }

  if (path.length === 0 && request.method === "POST") {
    await requirePermission(env.DB, user, tenantId, "company.contacts.manage");
    const body = await readJson(request);
    const id = crypto.randomUUID();
    const name = requiredString(body, "name", 120);
    const phone = phoneNumber(requiredString(body, "phone", 32));
    const email = optionalString(body, "email", 254);
    if (email) emailAddress(email);
    try {
      await env.DB
        .prepare(
          `INSERT INTO contacts (id, tenant_id, name, phone, email, notes)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(id, tenantId, name, phone, email || null, optionalString(body, "notes", 2000))
        .run();
    } catch (error) {
      if (isUniqueConstraint(error)) throw new ApiError(409, "contact_conflict", "Este telefone já está cadastrado nesta empresa.");
      throw error;
    }
    return json({ contact: await getContact(env, user, tenantId, id) }, 201);
  }

  if (path.length === 1) {
    const contactId = requiredId(path[0], "contato");
    const contact = await getContact(env, user, tenantId, contactId);
    if (!contact) throw new ApiError(404, "not_found", "Contato não encontrado.");

    if (request.method === "GET") {
      await requirePermission(env.DB, user, tenantId, "company.contacts.read");
      return json({ contact });
    }

    if (request.method === "PATCH") {
      await requirePermission(env.DB, user, tenantId, "company.contacts.manage");
      const body = await readJson(request);
      const updates: Array<[string, unknown]> = [];
      if (body.name !== undefined) updates.push(["name", requiredString(body, "name", 120)]);
      if (body.phone !== undefined) updates.push(["phone", phoneNumber(requiredString(body, "phone", 32))]);
      if (body.email !== undefined) {
        const email = optionalString(body, "email", 254);
        updates.push(["email", email ? emailAddress(email) : null]);
      }
      if (body.notes !== undefined) updates.push(["notes", optionalString(body, "notes", 2000)]);
      if (!updates.length) throw new ApiError(422, "empty_update", "Informe ao menos um campo para atualizar.");
      const setClause = updates.map(([column]) => `${column} = ?`).join(", ");
      try {
        await env.DB
          .prepare(
            `UPDATE contacts SET ${setClause}, updated_at = ?
             WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL`,
          )
          .bind(...updates.map(([, value]) => value), new Date().toISOString(), tenantId, contactId)
          .run();
      } catch (error) {
        if (isUniqueConstraint(error)) throw new ApiError(409, "contact_conflict", "Este telefone já está cadastrado nesta empresa.");
        throw error;
      }
      return json({ contact: await getContact(env, user, tenantId, contactId) });
    }

    if (request.method === "DELETE") {
      await requirePermission(env.DB, user, tenantId, "company.contacts.manage");
      const now = new Date().toISOString();
      await env.DB
        .prepare(
          `UPDATE contacts SET deleted_at = ?, updated_at = ?
           WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL`,
        )
        .bind(now, now, tenantId, contactId)
        .run();
      return json({ ok: true, deletedAt: now });
    }
  }

  throw new ApiError(405, "method_not_allowed", "Método não permitido para esta rota.");
}

async function handleConversations(
  request: Request,
  env: WorkerEnv,
  user: AuthenticatedUser,
  tenantId: string,
  path: string[],
): Promise<Response> {
  if (path.length === 0 && request.method === "GET") {
    await requirePermission(env.DB, user, tenantId, "company.conversations.read");
    const scope = isWideTenantRole(user)
      ? ""
      : `AND EXISTS (
           SELECT 1 FROM user_departments ud
           WHERE ud.tenant_id = cv.tenant_id AND ud.department_id = cv.department_id
             AND ud.user_id = ? AND ud.can_view_conversations = 1
         )`;
    const statement = env.DB.prepare(
      `SELECT cv.id, cv.tenant_id, cv.contact_id, ct.name AS contact_name,
              ct.phone AS contact_phone, ct.provider AS contact_provider, cv.department_id,
              d.name AS department_name, cv.assigned_user_id, u.name AS assigned_user_name,
              cv.subject, cv.status, cv.created_at, cv.updated_at
       FROM conversations cv
       JOIN contacts ct ON ct.id = cv.contact_id AND ct.tenant_id = cv.tenant_id AND ct.deleted_at IS NULL
       JOIN departments d ON d.id = cv.department_id AND d.tenant_id = cv.tenant_id AND d.deleted_at IS NULL
       LEFT JOIN users u ON u.id = cv.assigned_user_id AND u.tenant_id = cv.tenant_id AND u.deleted_at IS NULL
       WHERE cv.tenant_id = ? AND cv.deleted_at IS NULL ${scope}
       ORDER BY cv.updated_at DESC LIMIT 200`,
    );
    const result = isWideTenantRole(user)
      ? await statement.bind(tenantId).all()
      : await statement.bind(tenantId, user.id).all();
    return json({ conversations: result.results });
  }

  if (path.length === 0 && request.method === "POST") {
    await requirePermission(env.DB, user, tenantId, "company.conversations.manage");
    const body = await readJson(request);
    const contactId = requiredId(body.contactId, "contato");
    const departmentId = requiredId(body.departmentId, "setor");
    const assignedUserId = body.assignedUserId === undefined || body.assignedUserId === null
      ? null
      : requiredId(body.assignedUserId, "atendente");
    await requireDepartmentAccess(env.DB, user, tenantId, departmentId);
    await assertActiveRecord(env, "contacts", tenantId, contactId, "Contato");
    await assertActiveRecord(env, "departments", tenantId, departmentId, "Setor");
    if (assignedUserId) await assertAssignee(env, tenantId, departmentId, assignedUserId);
    const id = crypto.randomUUID();
    await env.DB
      .prepare(
        `INSERT INTO conversations (id, tenant_id, contact_id, department_id, assigned_user_id, subject)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, tenantId, contactId, departmentId, assignedUserId, optionalString(body, "subject", 200))
      .run();
    return json({ conversation: await getConversation(env, user, tenantId, id) }, 201);
  }

  if (path.length === 1) {
    const conversationId = requiredId(path[0], "conversa");
    if (request.method === "GET") {
      const conversation = await getConversation(env, user, tenantId, conversationId);
      if (!conversation) throw new ApiError(404, "not_found", "Conversa não encontrada.");
      await assertConversationAccess(env.DB, user, tenantId, conversationId, "company.conversations.read");
      return json({ conversation });
    }
    if (request.method === "PATCH") {
      const current = await getConversation(env, user, tenantId, conversationId);
      if (!current) throw new ApiError(404, "not_found", "Conversa não encontrada.");
      await assertConversationAccess(env.DB, user, tenantId, conversationId, "company.conversations.manage");
      const body = await readJson(request);
      const updates: Array<[string, unknown]> = [];
      if (body.subject !== undefined) updates.push(["subject", optionalString(body, "subject", 200)]);
      if (body.status !== undefined) updates.push(["status", oneOf(body.status, conversationStatuses, "status")]);
      const departmentId = body.departmentId === undefined
        ? current.department_id as string
        : requiredId(body.departmentId, "setor");
      const assignedUserId = body.assignedUserId === undefined
        ? current.assigned_user_id as string | null
        : body.assignedUserId === null
          ? null
          : requiredId(body.assignedUserId, "atendente");
      if (body.departmentId !== undefined) {
        await requireDepartmentAccess(env.DB, user, tenantId, departmentId);
        await assertActiveRecord(env, "departments", tenantId, departmentId, "Setor");
        updates.push(["department_id", departmentId]);
      }
      if (body.assignedUserId !== undefined) {
        if (assignedUserId) await assertAssignee(env, tenantId, departmentId, assignedUserId);
        updates.push(["assigned_user_id", assignedUserId]);
      } else if (body.departmentId !== undefined && assignedUserId) {
        await assertAssignee(env, tenantId, departmentId, assignedUserId);
      }
      if (!updates.length) throw new ApiError(422, "empty_update", "Informe ao menos um campo para atualizar.");
      updates.push(["updated_at", new Date().toISOString()]);
      const setClause = updates.map(([column]) => `${column} = ?`).join(", ");
      await env.DB
        .prepare(`UPDATE conversations SET ${setClause} WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL`)
        .bind(...updates.map(([, value]) => value), tenantId, conversationId)
        .run();
      return json({ conversation: await getConversation(env, user, tenantId, conversationId) });
    }
    if (request.method === "DELETE") {
      await assertConversationAccess(env.DB, user, tenantId, conversationId, "company.conversations.manage");
      const now = new Date().toISOString();
      const result = await env.DB
        .prepare(
          `UPDATE conversations SET deleted_at = ?, updated_at = ?
           WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL`,
        )
        .bind(now, now, tenantId, conversationId)
        .run();
      if (!result.meta.changes) throw new ApiError(404, "not_found", "Conversa não encontrada.");
      return json({ ok: true, deletedAt: now });
    }
  }

  if (path.length === 2 && path[1] === "messages") {
    const conversationId = requiredId(path[0], "conversa");
    const requiredPermission = request.method === "POST"
      ? "company.messages.reply"
      : "company.messages.read";
    await assertConversationAccess(env.DB, user, tenantId, conversationId, requiredPermission);

    if (request.method === "GET") {
      const result = await env.DB
        .prepare(
          `SELECT id, tenant_id, conversation_id, sender_user_id, direction, body, provider,
                  provider_external_id, provider_status, created_at
           FROM messages
           WHERE tenant_id = ? AND conversation_id = ? AND deleted_at IS NULL
           ORDER BY created_at LIMIT 500`,
        )
        .bind(tenantId, conversationId)
        .all();
      return json({ messages: result.results });
    }

    if (request.method === "POST") {
      const body = await readJson(request);
      const direction = oneOf(body.direction, ["outbound", "internal"] as const, "direction");
      const text = requiredString(body, "body", 10000);
      if (direction === "internal") {
        await requirePermission(env.DB, user, tenantId, "company.conversations.manage");
      } else {
        const conversation = await assertConversationAccess(
          env.DB,
          user,
          tenantId,
          conversationId,
          "company.messages.reply",
        );
        await requireDepartmentAccess(env.DB, user, tenantId, conversation.department_id, "can_reply");
      }

      const id = crypto.randomUUID();
      let providerExternalId: string | null = null;
      let providerStatus: string | null = null;
      let provider = "local";
      if (direction === "outbound") {
        const whatsappMessage = await sendWhatsAppText(env, tenantId, conversationId, text);
        providerExternalId = whatsappMessage?.id ?? null;
        if (whatsappMessage) provider = "whatsapp";
      }
      await env.DB
        .prepare(
          `INSERT INTO messages
           (id, tenant_id, conversation_id, sender_user_id, direction, body, provider, provider_external_id, provider_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(id, tenantId, conversationId, user.id, direction, text, provider, providerExternalId, providerStatus)
        .run();
      return json(
        { message: await getMessage(env, tenantId, conversationId, id) },
        201,
      );
    }
  }

  if (path.length === 3 && path[1] === "messages") {
    if (request.method !== "DELETE") throw new ApiError(405, "method_not_allowed", "Método não permitido.");
    const conversationId = requiredId(path[0], "conversa");
    const messageId = requiredId(path[2], "mensagem");
    const conversation = await assertConversationAccess(
      env.DB,
      user,
      tenantId,
      conversationId,
      "company.messages.delete",
    );
    await requireDepartmentAccess(env.DB, user, tenantId, conversation.department_id);
    const now = new Date().toISOString();
    const result = await env.DB
      .prepare(
        `UPDATE messages SET deleted_at = ?
         WHERE tenant_id = ? AND conversation_id = ? AND id = ? AND deleted_at IS NULL`,
      )
      .bind(now, tenantId, conversationId, messageId)
      .run();
    if (!result.meta.changes) throw new ApiError(404, "not_found", "Mensagem não encontrada.");
    return json({ ok: true, deletedAt: now });
  }

  if (path.length === 2 && path[1] === "tags") {
    const conversationId = requiredId(path[0], "conversa");
    await assertConversationAccess(env.DB, user, tenantId, conversationId, "company.conversations.read");
    if (request.method === "GET") {
      const result = await env.DB
        .prepare(
          `SELECT t.id, t.name, t.color FROM conversation_tags ct
           JOIN tags t ON t.id = ct.tag_id AND t.tenant_id = ct.tenant_id
           WHERE ct.tenant_id = ? AND ct.conversation_id = ? AND t.deleted_at IS NULL
           ORDER BY t.name`,
        )
        .bind(tenantId, conversationId)
        .all();
      return json({ tags: result.results });
    }
    if (request.method === "POST") {
      await requirePermission(env.DB, user, tenantId, "company.tags.manage");
      const body = await readJson(request);
      const tagId = requiredId(body.tagId, "etiqueta");
      await assertActiveRecord(env, "tags", tenantId, tagId, "Etiqueta");
      try {
        await env.DB
          .prepare(
            `INSERT INTO conversation_tags (tenant_id, conversation_id, tag_id)
             VALUES (?, ?, ?)`,
          )
          .bind(tenantId, conversationId, tagId)
          .run();
      } catch (error) {
        if (isUniqueConstraint(error)) throw new ApiError(409, "tag_already_applied", "Esta etiqueta já está aplicada.");
        throw error;
      }
      return json({ ok: true }, 201);
    }
  }

  if (path.length === 3 && path[1] === "tags" && request.method === "DELETE") {
    const conversationId = requiredId(path[0], "conversa");
    const tagId = requiredId(path[2], "etiqueta");
    await assertConversationAccess(env.DB, user, tenantId, conversationId, "company.conversations.manage");
    await requirePermission(env.DB, user, tenantId, "company.tags.manage");
    const result = await env.DB
      .prepare(
        `DELETE FROM conversation_tags WHERE tenant_id = ? AND conversation_id = ? AND tag_id = ?`,
      )
      .bind(tenantId, conversationId, tagId)
      .run();
    if (!result.meta.changes) throw new ApiError(404, "not_found", "Associação de etiqueta não encontrada.");
    return json({ ok: true });
  }

  throw new ApiError(405, "method_not_allowed", "Método não permitido para esta rota.");
}

async function handleTags(
  request: Request,
  env: WorkerEnv,
  user: AuthenticatedUser,
  tenantId: string,
  path: string[],
): Promise<Response> {
  if (path.length === 0 && request.method === "GET") {
    await requirePermission(env.DB, user, tenantId, "company.conversations.read");
    const result = await env.DB
      .prepare("SELECT id, tenant_id, name, color, created_at FROM tags WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY name")
      .bind(tenantId)
      .all();
    return json({ tags: result.results });
  }

  if (path.length === 0 && request.method === "POST") {
    await requirePermission(env.DB, user, tenantId, "company.tags.manage");
    const body = await readJson(request);
    const id = crypto.randomUUID();
    const name = requiredString(body, "name", 50);
    const color = optionalString(body, "color", 7, "#0f766e");
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new ApiError(422, "invalid_color", "Informe uma cor hexadecimal válida.");
    try {
      await env.DB
        .prepare("INSERT INTO tags (id, tenant_id, name, color) VALUES (?, ?, ?, ?)")
        .bind(id, tenantId, name, color)
        .run();
    } catch (error) {
      if (isUniqueConstraint(error)) throw new ApiError(409, "tag_conflict", "Esta etiqueta já existe nesta empresa.");
      throw error;
    }
    return json({ tag: await getTag(env, tenantId, id) }, 201);
  }

  if (path.length === 1) {
    const tagId = requiredId(path[0], "etiqueta");
    if (!(await getTag(env, tenantId, tagId))) throw new ApiError(404, "not_found", "Etiqueta não encontrada.");
    await requirePermission(env.DB, user, tenantId, "company.tags.manage");
    if (request.method === "PATCH") {
      const body = await readJson(request);
      const updates: Array<[string, unknown]> = [];
      if (body.name !== undefined) updates.push(["name", requiredString(body, "name", 50)]);
      if (body.color !== undefined) {
        const color = requiredString(body, "color", 7);
        if (!/^#[0-9a-f]{6}$/i.test(color)) throw new ApiError(422, "invalid_color", "Informe uma cor hexadecimal válida.");
        updates.push(["color", color]);
      }
      if (!updates.length) throw new ApiError(422, "empty_update", "Informe ao menos um campo para atualizar.");
      const setClause = updates.map(([column]) => `${column} = ?`).join(", ");
      try {
        await env.DB.prepare(`UPDATE tags SET ${setClause} WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL`)
          .bind(...updates.map(([, value]) => value), tenantId, tagId)
          .run();
      } catch (error) {
        if (isUniqueConstraint(error)) throw new ApiError(409, "tag_conflict", "Esta etiqueta já existe nesta empresa.");
        throw error;
      }
      return json({ tag: await getTag(env, tenantId, tagId) });
    }
    if (request.method === "DELETE") {
      const now = new Date().toISOString();
      await env.DB
        .prepare("UPDATE tags SET deleted_at = ? WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL")
        .bind(now, tenantId, tagId)
        .run();
      return json({ ok: true, deletedAt: now });
    }
  }

  throw new ApiError(405, "method_not_allowed", "Método não permitido para esta rota.");
}

function isWideTenantRole(user: AuthenticatedUser): boolean {
  return user.role === "platform_admin" || user.role === "company_admin";
}

function parseAssignments(value: unknown): DepartmentAssignment[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50) {
    throw new ApiError(422, "invalid_departments", "Informe uma lista válida de setores.");
  }
  const assignments = value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new ApiError(422, "invalid_departments", "Cada associação deve conter um setor e suas permissões.");
    }
    const assignment = item as Record<string, unknown>;
    return {
      departmentId: requiredId(assignment.departmentId, "setor"),
      canViewConversations: optionalBoolean(assignment, "canViewConversations", true),
      canReply: optionalBoolean(assignment, "canReply", false),
      canManageUsers: optionalBoolean(assignment, "canManageUsers", false),
    };
  });
  if (new Set(assignments.map((item) => item.departmentId)).size !== assignments.length) {
    throw new ApiError(422, "duplicate_department", "A lista contém setores duplicados.");
  }
  return assignments;
}

async function validateAssignments(
  env: WorkerEnv,
  tenantId: string,
  assignments: DepartmentAssignment[],
): Promise<void> {
  if (!assignments.length) return;
  const placeholders = assignments.map(() => "?").join(", ");
  const result = await env.DB
    .prepare(
      `SELECT COUNT(*) AS count FROM departments
       WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'active'
         AND id IN (${placeholders})`,
    )
    .bind(tenantId, ...assignments.map((item) => item.departmentId))
    .first<{ count: number }>();
  if (result?.count !== assignments.length) {
    throw new ApiError(422, "invalid_department", "Um ou mais setores não pertencem a esta empresa ou estão inativos.");
  }
}

async function replaceUserDepartments(
  env: WorkerEnv,
  tenantId: string,
  userId: string,
  assignments: DepartmentAssignment[],
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM user_departments WHERE tenant_id = ? AND user_id = ?").bind(tenantId, userId),
    ...assignments.map((assignment) =>
      env.DB
        .prepare(
          `INSERT INTO user_departments
           (tenant_id, user_id, department_id, can_view_conversations, can_reply, can_manage_users)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          tenantId,
          userId,
          assignment.departmentId,
          Number(assignment.canViewConversations),
          Number(assignment.canReply),
          Number(assignment.canManageUsers),
        ),
    ),
  ]);
}

async function getTenantUser(env: WorkerEnv, tenantId: string, userId: string) {
  return env.DB
    .prepare(
      `SELECT id, tenant_id, name, email, role, status, created_at, updated_at
       FROM users WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL LIMIT 1`,
    )
    .bind(tenantId, userId)
    .first();
}

async function getUserDepartments(env: WorkerEnv, tenantId: string, userId: string) {
  const result = await env.DB
    .prepare(
      `SELECT d.id, d.name, ud.can_view_conversations AS canViewConversations,
              ud.can_reply AS canReply, ud.can_manage_users AS canManageUsers
       FROM user_departments ud
       JOIN departments d ON d.id = ud.department_id AND d.tenant_id = ud.tenant_id
       WHERE ud.tenant_id = ? AND ud.user_id = ? AND d.deleted_at IS NULL
       ORDER BY d.name`,
    )
    .bind(tenantId, userId)
    .all();
  return result.results;
}

async function getDepartment(env: WorkerEnv, tenantId: string, departmentId: string) {
  return env.DB
    .prepare(
      `SELECT id, tenant_id, name, description, status, created_at
       FROM departments WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL LIMIT 1`,
    )
    .bind(tenantId, departmentId)
    .first();
}

async function getContact(
  env: WorkerEnv,
  user: AuthenticatedUser,
  tenantId: string,
  contactId: string,
) {
  const scope = isWideTenantRole(user)
    ? ""
    : `AND EXISTS (
         SELECT 1 FROM conversations cv
         JOIN user_departments ud
           ON ud.tenant_id = cv.tenant_id AND ud.department_id = cv.department_id
         WHERE cv.tenant_id = c.tenant_id AND cv.contact_id = c.id
           AND cv.deleted_at IS NULL AND ud.user_id = ? AND ud.can_view_conversations = 1
       )`;
  const statement = env.DB.prepare(
    `SELECT c.id, c.tenant_id, c.name, c.phone, c.email, c.notes, c.created_at, c.updated_at
     FROM contacts c
     WHERE c.tenant_id = ? AND c.id = ? AND c.deleted_at IS NULL ${scope} LIMIT 1`,
  );
  return isWideTenantRole(user)
    ? statement.bind(tenantId, contactId).first()
    : statement.bind(tenantId, contactId, user.id).first();
}

async function getConversation(
  env: WorkerEnv,
  user: AuthenticatedUser,
  tenantId: string,
  conversationId: string,
) {
  const scope = isWideTenantRole(user)
    ? ""
    : `AND EXISTS (
         SELECT 1 FROM user_departments ud
         WHERE ud.tenant_id = cv.tenant_id AND ud.department_id = cv.department_id
           AND ud.user_id = ? AND ud.can_view_conversations = 1
       )`;
  const statement = env.DB.prepare(
    `SELECT cv.id, cv.tenant_id, cv.contact_id, ct.name AS contact_name,
            ct.phone AS contact_phone, ct.provider AS contact_provider, cv.department_id,
            d.name AS department_name, cv.assigned_user_id, u.name AS assigned_user_name,
            cv.subject, cv.status, cv.created_at, cv.updated_at
     FROM conversations cv
     JOIN contacts ct ON ct.id = cv.contact_id AND ct.tenant_id = cv.tenant_id AND ct.deleted_at IS NULL
     JOIN departments d ON d.id = cv.department_id AND d.tenant_id = cv.tenant_id AND d.deleted_at IS NULL
     LEFT JOIN users u ON u.id = cv.assigned_user_id AND u.tenant_id = cv.tenant_id AND u.deleted_at IS NULL
     WHERE cv.tenant_id = ? AND cv.id = ? AND cv.deleted_at IS NULL ${scope}
     LIMIT 1`,
  );
  return isWideTenantRole(user)
    ? statement.bind(tenantId, conversationId).first()
    : statement.bind(tenantId, conversationId, user.id).first();
}

async function getMessage(
  env: WorkerEnv,
  tenantId: string,
  conversationId: string,
  messageId: string,
) {
  return env.DB
    .prepare(
      `SELECT id, tenant_id, conversation_id, sender_user_id, direction, body, provider,
              provider_external_id, provider_status, created_at
       FROM messages
       WHERE tenant_id = ? AND conversation_id = ? AND id = ? AND deleted_at IS NULL LIMIT 1`,
    )
    .bind(tenantId, conversationId, messageId)
    .first();
}

async function getTag(env: WorkerEnv, tenantId: string, tagId: string) {
  return env.DB
    .prepare("SELECT id, tenant_id, name, color, created_at FROM tags WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL LIMIT 1")
    .bind(tenantId, tagId)
    .first();
}

async function assertActiveRecord(
  env: WorkerEnv,
  table: "contacts" | "departments" | "tags",
  tenantId: string,
  id: string,
  label: string,
): Promise<void> {
  const record = await env.DB
    .prepare(`SELECT id FROM ${table} WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL LIMIT 1`)
    .bind(tenantId, id)
    .first<{ id: string }>();
  if (!record) throw new ApiError(404, "not_found", `${label} não encontrado.`);
}

async function assertAssignee(
  env: WorkerEnv,
  tenantId: string,
  departmentId: string,
  userId: string,
): Promise<void> {
  const match = await env.DB
    .prepare(
      `SELECT 1 AS allowed
       FROM users u
       JOIN user_departments ud ON ud.user_id = u.id AND ud.tenant_id = u.tenant_id
       JOIN departments d ON d.id = ud.department_id AND d.tenant_id = ud.tenant_id
       WHERE u.tenant_id = ? AND u.id = ? AND u.status = 'active' AND u.deleted_at IS NULL
         AND ud.department_id = ? AND d.status = 'active' AND d.deleted_at IS NULL
       LIMIT 1`,
    )
    .bind(tenantId, userId, departmentId)
    .first<{ allowed: number }>();
  if (!match) throw new ApiError(422, "invalid_assignee", "O atendente não pertence a este setor.");
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Error && /unique constraint/i.test(error.message);
}
