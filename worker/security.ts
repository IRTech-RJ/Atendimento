import { ApiError } from "./errors";

const PASSWORD_ITERATIONS = 600_000;
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const SESSION_COOKIE = "irtech_session";
const textEncoder = new TextEncoder();

export interface AuthenticatedUser {
  id: string;
  tenantId: string | null;
  name: string;
  email: string;
  role: "platform_admin" | "company_admin" | "supervisor" | "agent";
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function derivePassword(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const result = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(result);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(new ArrayBuffer(16));
  crypto.getRandomValues(salt);
  const derived = await derivePassword(password, salt, PASSWORD_ITERATIONS);
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(derived)}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, rawIterations, rawSalt, rawExpected] = storedHash.split("$");
  const iterations = Number(rawIterations);
  if (
    algorithm !== "pbkdf2-sha256" ||
    !Number.isInteger(iterations) ||
    iterations < 100_000 ||
    iterations > 1_000_000 ||
    !rawSalt ||
    !rawExpected
  ) {
    return false;
  }

  try {
    const actual = await derivePassword(password, fromBase64Url(rawSalt), iterations);
    const expected = fromBase64Url(rawExpected);
    if (actual.length !== expected.length) return false;
    let difference = 0;
    for (let index = 0; index < actual.length; index += 1) {
      difference |= actual[index] ^ expected[index];
    }
    return difference === 0;
  } catch {
    return false;
  }
}

async function sha256(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", textEncoder.encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cookieValue(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name === SESSION_COOKIE) return valueParts.join("=") || null;
  }
  return null;
}

function sessionCookie(request: Request, token: string, maxAge: number): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export async function createSession(
  db: D1Database,
  userId: string,
  request: Request,
): Promise<{ cookie: string; expiresAt: string }> {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  await db
    .prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, tokenHash, expiresAt)
    .run();

  return { cookie: sessionCookie(request, token, SESSION_TTL_SECONDS), expiresAt };
}

export async function currentUser(db: D1Database, request: Request): Promise<AuthenticatedUser | null> {
  const token = cookieValue(request);
  if (!token) return null;

  const tokenHash = await sha256(token);
  const row = await db
    .prepare(
      `SELECT u.id, u.tenant_id, u.name, u.email, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN companies c ON c.id = u.tenant_id
       WHERE s.token_hash = ?
         AND s.revoked_at IS NULL
         AND s.expires_at > ?
         AND u.status = 'active'
         AND u.deleted_at IS NULL
         AND (u.tenant_id IS NULL OR (c.status = 'active' AND c.deleted_at IS NULL))
       LIMIT 1`,
    )
    .bind(tokenHash, new Date().toISOString())
    .first<{
      id: string;
      tenant_id: string | null;
      name: string;
      email: string;
      role: AuthenticatedUser["role"];
    }>();

  if (!row) return null;
  return { id: row.id, tenantId: row.tenant_id, name: row.name, email: row.email, role: row.role };
}

export async function revokeSession(db: D1Database, request: Request): Promise<string> {
  const token = cookieValue(request);
  if (token) {
    await db
      .prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL")
      .bind(new Date().toISOString(), await sha256(token))
      .run();
  }
  return sessionCookie(request, "", 0);
}

export function requireAuthenticated(user: AuthenticatedUser | null): AuthenticatedUser {
  if (!user) throw new ApiError(401, "unauthenticated", "Faça login para continuar.");
  return user;
}

export function verifySecret(candidate: string, expected: string): boolean {
  const left = textEncoder.encode(candidate);
  const right = textEncoder.encode(expected);
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

export function apiError(status: number, code: string, message: string): ApiError {
  return new ApiError(status, code, message);
}
