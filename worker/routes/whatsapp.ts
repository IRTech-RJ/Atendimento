import { requirePermission, requireTenantAccess, type WorkerEnv } from "../authorization";
import { ApiError } from "../errors";
import { json, readJson, requiredId, requiredString } from "../http";
import type { AuthenticatedUser } from "../security";

interface WhatsAppAccount {
  tenant_id: string;
  phone_number_id: string;
  access_token_encrypted: string;
  verify_token: string;
  default_department_id: string;
  enabled: number;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function secretKey(env: WorkerEnv): Promise<CryptoKey> {
  if (!env.WHATSAPP_DATA_ENCRYPTION_KEY) {
    throw new ApiError(
      503,
      "whatsapp_encryption_not_configured",
      "Configure WHATSAPP_DATA_ENCRYPTION_KEY antes de cadastrar credenciais da Meta.",
    );
  }
  const derived = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(env.WHATSAPP_DATA_ENCRYPTION_KEY),
  );
  return crypto.subtle.importKey("raw", derived, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptSecret(env: WorkerEnv, secret: string): Promise<string> {
  const key = await secretKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(secret),
  );
  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(encrypted))}`;
}

async function decryptSecret(env: WorkerEnv, value: string): Promise<string> {
  const [rawIv, rawCiphertext] = value.split(".");
  if (!rawIv || !rawCiphertext) throw new ApiError(500, "whatsapp_secret_invalid", "Credencial criptografada inválida.");
  try {
    const key = await secretKey(env);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlToBytes(rawIv) },
      key,
      base64UrlToBytes(rawCiphertext),
    );
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "whatsapp_secret_invalid", "Não foi possível descriptografar a credencial da Meta.");
  }
}

export async function handleWhatsAppAccountRoutes(
  request: Request,
  env: WorkerEnv,
  user: AuthenticatedUser,
  tenantId: string,
  path: string[],
): Promise<Response> {
  await requireTenantAccess(env.DB, user, tenantId);
  if (user.role !== "platform_admin" && user.role !== "company_admin") {
    throw new ApiError(
      403,
      "whatsapp_admin_only",
      "Somente o administrador da empresa pode configurar o WhatsApp.",
    );
  }
  await requirePermission(env.DB, user, tenantId, "company.conversations.manage");
  if (path.length !== 0) throw new ApiError(404, "not_found", "Rota não encontrada.");

  if (request.method === "GET") {
    const account = await env.DB
      .prepare(
        `SELECT tenant_id, phone_number_id, verify_token, default_department_id,
                enabled, created_at, updated_at
         FROM whatsapp_accounts WHERE tenant_id = ? LIMIT 1`,
      )
      .bind(tenantId)
      .first();
    return json({ account: account ?? null });
  }

  if (request.method === "PUT") {
    const body = await readJson(request);
    const phoneNumberId = requiredString(body, "phoneNumberId", 100);
    const accessToken = requiredString(body, "accessToken", 1000);
    const verifyToken = requiredString(body, "verifyToken", 200);
    const defaultDepartmentId = requiredId(body.defaultDepartmentId, "setor");
    const department = await env.DB
      .prepare(
        `SELECT id FROM departments
         WHERE tenant_id = ? AND id = ? AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
      )
      .bind(tenantId, defaultDepartmentId)
      .first<{ id: string }>();
    if (!department) {
      throw new ApiError(422, "invalid_department", "O setor padrão não existe ou está indisponível.");
    }

    const enabled = body.enabled === undefined ? true : body.enabled === true;
    const encryptedAccessToken = await encryptSecret(env, accessToken);
    const now = new Date().toISOString();
    await env.DB
      .prepare(
        `INSERT INTO whatsapp_accounts
         (tenant_id, phone_number_id, access_token_encrypted, verify_token, default_department_id, enabled, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id) DO UPDATE SET
           phone_number_id = excluded.phone_number_id,
           access_token_encrypted = excluded.access_token_encrypted,
           verify_token = excluded.verify_token,
           default_department_id = excluded.default_department_id,
           enabled = excluded.enabled,
           updated_at = excluded.updated_at`,
      )
      .bind(tenantId, phoneNumberId, encryptedAccessToken, verifyToken, defaultDepartmentId, Number(enabled), now)
      .run();
    return json({
      account: {
        tenantId,
        phoneNumberId,
        verifyToken,
        defaultDepartmentId,
        enabled,
        updatedAt: now,
      },
    });
  }

  if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM whatsapp_accounts WHERE tenant_id = ?").bind(tenantId).run();
    return json({ ok: true });
  }

  throw new ApiError(405, "method_not_allowed", "Método não permitido para esta rota.");
}

export async function handleWhatsAppWebhook(request: Request, env: WorkerEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/webhooks/whatsapp") return null;

  if (request.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode !== "subscribe" || !token || !challenge) {
      throw new ApiError(403, "invalid_webhook_verification", "Solicitação de verificação inválida.");
    }
    const account = await env.DB
      .prepare("SELECT verify_token FROM whatsapp_accounts WHERE verify_token = ? AND enabled = 1 LIMIT 1")
      .bind(token)
      .first<{ verify_token: string }>();
    if (!account) throw new ApiError(403, "invalid_verify_token", "Token de verificação inválido.");
    return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }

  if (request.method !== "POST") {
    throw new ApiError(405, "method_not_allowed", "Método não permitido para este webhook.");
  }

  await verifyWebhookSignature(request, env);
  const body = await readJson(request);
  await processWhatsAppWebhook(env, body);
  return json({ received: true });
}

async function verifyWebhookSignature(request: Request, env: WorkerEnv): Promise<void> {
  if (!env.WHATSAPP_APP_SECRET) {
    throw new ApiError(
      503,
      "webhook_not_configured",
      "Configure WHATSAPP_APP_SECRET antes de receber webhooks da Meta.",
    );
  }
  const signature = request.headers.get("x-hub-signature-256");
  if (!signature?.startsWith("sha256=")) {
    throw new ApiError(401, "invalid_webhook_signature", "Assinatura do webhook ausente.");
  }
  const payload = await request.clone().arrayBuffer();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.WHATSAPP_APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, payload);
  const supplied = signature.slice("sha256=".length);
  if (!/^[0-9a-f]+$/i.test(supplied) || supplied.length !== 64) {
    throw new ApiError(401, "invalid_webhook_signature", "Assinatura do webhook inválida.");
  }
  const suppliedBytes = Uint8Array.from(
    supplied.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [],
  );
  const signedBytes = new Uint8Array(signed);
  let difference = suppliedBytes.length ^ signedBytes.length;
  const length = Math.max(suppliedBytes.length, signedBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (suppliedBytes[index] ?? 0) ^ (signedBytes[index] ?? 0);
  }
  if (difference !== 0) {
    throw new ApiError(401, "invalid_webhook_signature", "Assinatura do webhook inválida.");
  }
}

async function processWhatsAppWebhook(env: WorkerEnv, body: Record<string, unknown>): Promise<void> {
  const entries = Array.isArray(body.entry) ? body.entry as Array<Record<string, unknown>> : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes as Array<Record<string, unknown>> : [];
    for (const change of changes) {
      const value = change.value as Record<string, unknown> | undefined;
      if (!value) continue;
      const metadata = value.metadata as Record<string, unknown> | undefined;
      const phoneNumberId = typeof metadata?.phone_number_id === "string" ? metadata.phone_number_id : "";
      if (!phoneNumberId) continue;

      const account = await env.DB
        .prepare(
          `SELECT tenant_id, default_department_id
           FROM whatsapp_accounts
           WHERE phone_number_id = ? AND enabled = 1 LIMIT 1`,
        )
        .bind(phoneNumberId)
        .first<{ tenant_id: string; default_department_id: string }>();
      if (!account) continue;

      const statuses = Array.isArray(value.statuses) ? value.statuses as Array<Record<string, unknown>> : [];
      for (const status of statuses) {
        const externalId = typeof status.id === "string" ? status.id : "";
        const providerStatus = typeof status.status === "string" ? status.status : "";
        if (externalId && providerStatus) {
          await env.DB
            .prepare(
              `UPDATE messages SET provider_status = ?
               WHERE tenant_id = ? AND provider = 'whatsapp' AND provider_external_id = ?`,
            )
            .bind(providerStatus, account.tenant_id, externalId)
            .run();
        }
      }

      const messages = Array.isArray(value.messages) ? value.messages as Array<Record<string, unknown>> : [];
      for (const message of messages) {
        await receiveWhatsAppMessage(env, account.tenant_id, account.default_department_id, message);
      }
    }
  }
}

async function receiveWhatsAppMessage(
  env: WorkerEnv,
  tenantId: string,
  departmentId: string,
  message: Record<string, unknown>,
): Promise<void> {
  const externalId = typeof message.id === "string" ? message.id : "";
  if (!externalId) return;
  const duplicate = await env.DB
    .prepare("SELECT id FROM messages WHERE tenant_id = ? AND provider_external_id = ? LIMIT 1")
    .bind(tenantId, externalId)
    .first<{ id: string }>();
  if (duplicate) return;

  const waId = typeof message.from === "string" ? message.from : "";
  if (!waId) return;
  const phone = `+${waId.replace(/\D/g, "")}`;
  const textRecord = message.text as Record<string, unknown> | undefined;
  const text = typeof textRecord?.body === "string"
    ? textRecord.body
    : "Mídia ou mensagem não suportada recebida pelo WhatsApp.";
  const timestampSeconds = typeof message.timestamp === "string" ? Number(message.timestamp) : NaN;
  const timestampDate = Number.isFinite(timestampSeconds) ? new Date(timestampSeconds * 1000) : new Date();
  const timestamp = Number.isFinite(timestampDate.getTime()) ? timestampDate.toISOString() : new Date().toISOString();

  let contact = await env.DB
    .prepare(
      `SELECT id FROM contacts
       WHERE tenant_id = ? AND phone = ? AND deleted_at IS NULL LIMIT 1`,
    )
    .bind(tenantId, phone)
    .first<{ id: string }>();
  if (!contact) {
    const contactId = crypto.randomUUID();
    await env.DB
      .prepare("INSERT INTO contacts (id, tenant_id, name, phone, notes) VALUES (?, ?, ?, ?, '')")
      .bind(contactId, tenantId, phone, phone)
      .run();
    contact = { id: contactId };
  }

  let conversation = await env.DB
    .prepare(
      `SELECT id FROM conversations
       WHERE tenant_id = ? AND contact_id = ? AND status IN ('open', 'pending') AND deleted_at IS NULL
       ORDER BY updated_at DESC LIMIT 1`,
    )
    .bind(tenantId, contact.id)
    .first<{ id: string }>();
  if (!conversation) {
    const conversationId = crypto.randomUUID();
    await env.DB
      .prepare(
        `INSERT INTO conversations
         (id, tenant_id, contact_id, department_id, subject)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(conversationId, tenantId, contact.id, departmentId, `WhatsApp ${phone}`)
      .run();
    conversation = { id: conversationId };
  }

  await env.DB
    .prepare(
      `INSERT INTO messages
       (id, tenant_id, conversation_id, sender_user_id, direction, body, created_at,
        provider, provider_external_id, provider_status)
       VALUES (?, ?, ?, NULL, 'inbound', ?, ?, 'whatsapp', ?, 'received')`,
    )
    .bind(crypto.randomUUID(), tenantId, conversation.id, text, timestamp, externalId)
    .run();
  await env.DB
    .prepare("UPDATE conversations SET status = 'open', updated_at = ? WHERE tenant_id = ? AND id = ?")
    .bind(timestamp, tenantId, conversation.id)
    .run();
}

export async function sendWhatsAppText(
  env: WorkerEnv,
  tenantId: string,
  conversationId: string,
  text: string,
): Promise<{ id: string } | null> {
  const account = await env.DB
    .prepare(
      `SELECT wa.phone_number_id, wa.access_token_encrypted
       FROM whatsapp_accounts wa
       WHERE wa.tenant_id = ? AND wa.enabled = 1 LIMIT 1`,
    )
    .bind(tenantId)
    .first<{ phone_number_id: string; access_token_encrypted: string }>();
  if (!account) return null;
  const accessToken = await decryptSecret(env, account.access_token_encrypted);

  const conversation = await env.DB
    .prepare(
      `SELECT ct.phone FROM conversations cv
       JOIN contacts ct ON ct.id = cv.contact_id AND ct.tenant_id = cv.tenant_id
       WHERE cv.tenant_id = ? AND cv.id = ? AND cv.deleted_at IS NULL LIMIT 1`,
    )
    .bind(tenantId, conversationId)
    .first<{ phone: string }>();
  if (!conversation) throw new ApiError(404, "not_found", "Conversa não encontrada.");

  const recipient = conversation.phone.replace(/\D/g, "");
  const version = env.WHATSAPP_GRAPH_VERSION ?? "v22.0";
  let response: Response;
  try {
    response = await fetch(
      `https://graph.facebook.com/${version}/${account.phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "text",
          text: { preview_url: false, body: text },
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch (error) {
    throw new ApiError(
      502,
      "whatsapp_send_failed",
      error instanceof Error ? `Falha de conexão com a Meta: ${error.name}.` : "Falha de conexão com a Meta.",
    );
  }
  const payload = await response.json() as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new ApiError(
      502,
      "whatsapp_send_failed",
      payload.error?.message ?? "Não foi possível enviar pela WhatsApp Cloud API.",
    );
  }
  const id = payload.messages?.[0]?.id;
  if (!id) {
    throw new ApiError(502, "whatsapp_send_failed", "A Meta não retornou o identificador da mensagem.");
  }
  return { id };
}
