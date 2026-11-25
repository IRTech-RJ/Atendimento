import { ApiError } from "./errors";

const MAX_JSON_BYTES = 32 * 1024;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[1-9]\d{6,14}$/;

export type JsonRecord = Record<string, unknown>;

export function json(
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  return Response.json(body, { status, headers: responseHeaders });
}

export async function readJson(request: Request): Promise<JsonRecord> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new ApiError(415, "unsupported_media_type", "Envie o corpo como application/json.");
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_JSON_BYTES) {
    throw new ApiError(413, "payload_too_large", "O corpo da requisição excede o limite.");
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
    throw new ApiError(413, "payload_too_large", "O corpo da requisição excede o limite.");
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ApiError(400, "invalid_json", "O corpo da requisição não contém JSON válido.");
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "invalid_body", "O corpo deve ser um objeto JSON.");
  }

  return value as JsonRecord;
}

export function requiredString(
  body: JsonRecord,
  key: string,
  maxLength: number,
  minLength = 1,
): string {
  const value = body[key];
  if (typeof value !== "string") {
    throw new ApiError(422, "invalid_field", `O campo ${key} é obrigatório.`);
  }
  const normalized = value.trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw new ApiError(422, "invalid_field", `O campo ${key} deve ter de ${minLength} a ${maxLength} caracteres.`);
  }
  return normalized;
}

export function optionalString(
  body: JsonRecord,
  key: string,
  maxLength: number,
  fallback = "",
): string {
  const value = body[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") {
    throw new ApiError(422, "invalid_field", `O campo ${key} deve ser um texto.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ApiError(422, "invalid_field", `O campo ${key} deve ter no máximo ${maxLength} caracteres.`);
  }
  return normalized;
}

export function requiredPassword(body: JsonRecord): string {
  const value = body.password;
  if (typeof value !== "string") {
    throw new ApiError(422, "invalid_password", "Informe uma senha.");
  }
  const characterCount = [...value].length;
  if (characterCount < 12 || characterCount > 128 || new TextEncoder().encode(value).length > 256) {
    throw new ApiError(422, "invalid_password", "A senha deve ter de 12 a 128 caracteres.");
  }
  return value;
}

export function emailAddress(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !emailPattern.test(email)) {
    throw new ApiError(422, "invalid_email", "Informe um e-mail válido.");
  }
  return email;
}

export function phoneNumber(value: string): string {
  const phone = value.replace(/[()\s.-]/g, "");
  if (!phonePattern.test(phone)) {
    throw new ApiError(422, "invalid_phone", "Informe um telefone com código do país e DDD.");
  }
  return phone;
}

export function oneOf<T extends string>(
  value: unknown,
  choices: readonly T[],
  field: string,
): T {
  if (typeof value !== "string" || !choices.includes(value as T)) {
    throw new ApiError(422, "invalid_field", `O valor informado para ${field} não é válido.`);
  }
  return value as T;
}

export function optionalBoolean(body: JsonRecord, key: string, fallback: boolean): boolean {
  const value = body[key];
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") {
    throw new ApiError(422, "invalid_field", `O campo ${key} deve ser verdadeiro ou falso.`);
  }
  return value;
}

export function requiredId(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) {
    throw new ApiError(422, "invalid_id", `O identificador de ${field} não é válido.`);
  }
  return value;
}

export function slugFromName(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  if (!slug) throw new ApiError(422, "invalid_name", "O nome não pode gerar um identificador válido.");
  return slug;
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    throw new ApiError(403, "invalid_origin", "A origem da requisição não é permitida.");
  }
}
