import { randomUUID } from "node:crypto";

const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:5173";
const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  console.error("Defina TEST_ADMIN_EMAIL e TEST_ADMIN_PASSWORD com as credenciais do administrador IR Tech.");
  process.exit(1);
}

const companiesToDelete = [];
let platformCookie = "";
let failed = false;

async function request(path, { method = "GET", body, cookie = "", expected = 200 } = {}) {
  const headers = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    headers.Origin = baseUrl;
  }
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) headers.Origin = baseUrl;
  if (cookie) headers.Cookie = cookie;

  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (response.status !== expected) {
    throw new Error(`${method} ${path}: esperado HTTP ${expected}, recebido ${response.status}.`);
  }
  const setCookie = response.headers.get("set-cookie");
  return {
    payload,
    cookie: setCookie ? setCookie.split(";")[0] : cookie,
  };
}

async function createCompany(name, segment, city) {
  const result = await request("/api/admin/companies", {
    method: "POST",
    cookie: platformCookie,
    expected: 201,
    body: {
      name,
      slug: `${name.toLowerCase().replace(/[^a-z]+/g, "-")}-${randomUUID().slice(0, 8)}`,
      segment,
      city,
    },
  });
  companiesToDelete.push(result.payload.company.id);
  return result.payload.company;
}

async function createDepartment(companyId, name) {
  const result = await request(`/api/tenants/${companyId}/departments`, {
    method: "POST",
    cookie: platformCookie,
    expected: 201,
    body: { name, description: "Registro fictício de teste" },
  });
  return result.payload.department;
}

async function createCompanyUser(companyId, departmentId, role, email) {
  const password = `Teste!${randomUUID()}#Aa1`;
  const result = await request(`/api/tenants/${companyId}/users`, {
    method: "POST",
    cookie: platformCookie,
    expected: 201,
    body: {
      name: `Usuário ${role}`,
      email,
      password,
      role,
      departments: departmentId
        ? [{ departmentId, canViewConversations: true, canReply: true }]
        : [],
    },
  });
  return { user: result.payload.user, password };
}

async function login(workspace, email, password) {
  const result = await request("/api/auth/login", {
    method: "POST",
    expected: 200,
    body: { workspace, email, password },
  });
  return { user: result.payload.user, cookie: result.cookie };
}

function fakePhone(areaCode) {
  const digits = Array.from(crypto.getRandomValues(new Uint8Array(9)), (value) => value % 10).join("");
  return `+55${areaCode}${digits}`;
}

async function run() {
  const admin = await login("ir-tech", adminEmail, adminPassword);
  platformCookie = admin.cookie;
  assert(admin.user.role === "platform_admin", "A conta informada não é administradora IR Tech.");
  await request("/api/auth/login", {
    method: "POST",
    expected: 401,
    body: { workspace: "ir-tech", email: adminEmail, password: `errado-${randomUUID()}` },
  });

  const companyA = await createCompany("Empresa Teste Aurora", "Varejo", "Campinas, SP");
  const companyB = await createCompany("Empresa Teste Horizonte", "Comércio", "Sorocaba, SP");
  const departmentA = await createDepartment(companyA.id, "Delivery");
  const departmentARestricted = await createDepartment(companyA.id, "Financeiro");
  const departmentB = await createDepartment(companyB.id, "Atendimento");

  const companyAdminA = await createCompanyUser(
    companyA.id,
    null,
    "company_admin",
    `admin-${randomUUID()}@empresa-a.example`,
  );
  const companyAdminB = await createCompanyUser(
    companyB.id,
    null,
    "company_admin",
    `admin-${randomUUID()}@empresa-b.example`,
  );
  const agentA = await createCompanyUser(
    companyA.id,
    departmentA.id,
    "agent",
    `agent-${randomUUID()}@empresa-a.example`,
  );
  const loginA = await login(companyA.slug, companyAdminA.user.email, companyAdminA.password);
  const loginB = await login(companyB.slug, companyAdminB.user.email, companyAdminB.password);
  const loginAgent = await login(companyA.slug, agentA.user.email, agentA.password);
  assert(loginA.user.tenantId === companyA.id, "O login não ficou associado ao tenant correto.");

  const trial = await request(`/api/tenants/${companyA.id}/trial`, { cookie: loginA.cookie });
  assert(
    trial.payload.trial.startedAt === null && trial.payload.trial.endsAt === null && !trial.payload.trial.expired,
    "O trial não deve começar antes da primeira conexão de canal.",
  );
  await request(`/api/tenants/${companyA.id}/telegram`, { cookie: loginA.cookie, expected: 501 });
  await request(`/api/tenants/${companyA.id}/telegram`, { cookie: loginAgent.cookie, expected: 501 });
  await request("/api/webhooks/telegram", {
    method: "POST",
    body: { update_id: 1 },
    expected: 401,
  });

  const contactA = await request(`/api/tenants/${companyA.id}/contacts`, {
    method: "POST",
    cookie: loginA.cookie,
    expected: 201,
    body: { name: "Contato Fictício A", phone: fakePhone("19") },
  });
  const contactB = await request(`/api/tenants/${companyB.id}/contacts`, {
    method: "POST",
    cookie: loginB.cookie,
    expected: 201,
    body: { name: "Contato Fictício B", phone: fakePhone("15") },
  });
  const conversationA = await request(`/api/tenants/${companyA.id}/conversations`, {
    method: "POST",
    cookie: loginA.cookie,
    expected: 201,
    body: { contactId: contactA.payload.contact.id, departmentId: departmentA.id, subject: "Conversa fictícia A" },
  });
  const restrictedConversation = await request(`/api/tenants/${companyA.id}/conversations`, {
    method: "POST",
    cookie: loginA.cookie,
    expected: 201,
    body: { contactId: contactA.payload.contact.id, departmentId: departmentARestricted.id, subject: "Setor restrito" },
  });
  const conversationB = await request(`/api/tenants/${companyB.id}/conversations`, {
    method: "POST",
    cookie: loginB.cookie,
    expected: 201,
    body: { contactId: contactB.payload.contact.id, departmentId: departmentB.id, subject: "Conversa fictícia B" },
  });

  const contactsA = await request(`/api/tenants/${companyA.id}/contacts`, { cookie: loginA.cookie });
  assert(
    contactsA.payload.contacts.length === 1 && contactsA.payload.contacts[0].id === contactA.payload.contact.id,
    "A listagem de contatos não respeitou o tenant A.",
  );
  await request(`/api/tenants/${companyB.id}/contacts`, { cookie: loginA.cookie, expected: 404 });
  await request(`/api/tenants/${companyA.id}/conversations`, {
    method: "POST",
    cookie: loginA.cookie,
    expected: 404,
    body: { contactId: contactB.payload.contact.id, departmentId: departmentA.id },
  });
  await request("/api/admin/companies", { cookie: loginA.cookie, expected: 403 });

  const agentConversations = await request(`/api/tenants/${companyA.id}/conversations`, { cookie: loginAgent.cookie });
  assert(
    agentConversations.payload.conversations.length === 1 &&
      agentConversations.payload.conversations[0].id === conversationA.payload.conversation.id,
    "O atendente acessou conversas de um setor não associado.",
  );
  await request(
    `/api/tenants/${companyA.id}/conversations/${restrictedConversation.payload.conversation.id}/messages`,
    { cookie: loginAgent.cookie, expected: 404 },
  );
  await request(`/api/tenants/${companyB.id}/contacts`, { cookie: loginAgent.cookie, expected: 404 });
  await request(`/api/tenants/${companyA.id}/departments`, {
    method: "POST",
    cookie: loginAgent.cookie,
    expected: 403,
    body: { name: "Sem permissão" },
  });

  await request(`/api/tenants/${companyA.id}/conversations/${conversationA.payload.conversation.id}/messages`, {
    method: "POST",
    cookie: loginAgent.cookie,
    expected: 201,
    body: { direction: "outbound", body: "Mensagem fictícia registrada localmente." },
  });
  await request(`/api/tenants/${companyA.id}/users/${agentA.user.id}/permissions`, {
    method: "PUT",
    cookie: loginA.cookie,
    body: { permissions: [{ id: "company.messages.reply", allowed: false }] },
  });
  await request(`/api/tenants/${companyA.id}/conversations/${conversationA.payload.conversation.id}/messages`, {
    method: "POST",
    cookie: loginAgent.cookie,
    expected: 403,
    body: { direction: "outbound", body: "Esta resposta deve ser negada." },
  });

  const tag = await request(`/api/tenants/${companyA.id}/tags`, {
    method: "POST",
    cookie: loginA.cookie,
    expected: 201,
    body: { name: "Teste", color: "#0f766e" },
  });
  await request(`/api/tenants/${companyA.id}/conversations/${conversationA.payload.conversation.id}/tags`, {
    method: "POST",
    cookie: loginA.cookie,
    expected: 201,
    body: { tagId: tag.payload.tag.id },
  });
  const attachedTags = await request(
    `/api/tenants/${companyA.id}/conversations/${conversationA.payload.conversation.id}/tags`,
    { cookie: loginA.cookie },
  );
  assert(attachedTags.payload.tags.length === 1, "A associação da etiqueta não foi salva.");
  await request(`/api/tenants/${companyB.id}/conversations/${conversationB.payload.conversation.id}/messages`, {
    cookie: loginA.cookie,
    expected: 404,
  });

  const deletableContact = await request(`/api/tenants/${companyB.id}/contacts`, {
    method: "POST",
    cookie: loginB.cookie,
    expected: 201,
    body: { name: "Contato removível", phone: fakePhone("15") },
  });
  await request(`/api/tenants/${companyB.id}/contacts/${deletableContact.payload.contact.id}`, {
    method: "DELETE",
    cookie: loginB.cookie,
  });
  const remainingContacts = await request(`/api/tenants/${companyB.id}/contacts`, { cookie: loginB.cookie });
  assert(remainingContacts.payload.contacts.every((item) => item.id !== deletableContact.payload.contact.id), "A exclusão lógica não foi aplicada.");

  await request("/api/auth/logout", { method: "POST", cookie: loginAgent.cookie, body: {} });
  const endedSession = await request("/api/auth/me", { cookie: loginAgent.cookie });
  assert(endedSession.payload.user === null, "A sessão encerrada continuou autenticada.");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  await run();
  console.log("API multi-tenant: autenticação, RBAC, permissões individuais/de setor, isolamento A/B, contatos, conversas, mensagens, etiquetas, exclusão lógica e logout passaram.");
} catch (error) {
  failed = true;
  console.error(error instanceof Error ? error.message : "Falha inesperada nos testes da API.");
} finally {
  if (platformCookie) {
    for (const companyId of companiesToDelete) {
      try {
        await request(`/api/admin/companies/${companyId}`, {
          method: "DELETE",
          cookie: platformCookie,
        });
      } catch (error) {
        failed = true;
        console.error(error instanceof Error ? `Falha ao excluir logicamente empresa de teste ${companyId}.` : "Falha ao limpar empresa de teste.");
      }
    }
  }
}

if (failed) process.exitCode = 1;
