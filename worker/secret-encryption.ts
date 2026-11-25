import { ApiError } from "./errors";
import type { WorkerEnv } from "./authorization";

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

async function encryptionKey(env: WorkerEnv): Promise<CryptoKey> {
  const material = env.DATA_ENCRYPTION_KEY ?? env.WHATSAPP_DATA_ENCRYPTION_KEY;
  if (!material) {
    throw new ApiError(
      503,
      "secret_encryption_not_configured",
      "Configure DATA_ENCRYPTION_KEY para armazenar credenciais de canais.",
    );
  }
  const derived = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return crypto.subtle.importKey("raw", derived, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(env: WorkerEnv, secret: string): Promise<string> {
  const key = await encryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(secret),
  );
  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptSecret(env: WorkerEnv, value: string): Promise<string> {
  const [rawIv, rawCiphertext] = value.split(".");
  if (!rawIv || !rawCiphertext) {
    throw new ApiError(500, "secret_invalid", "A credencial criptografada está inválida.");
  }
  try {
    const key = await encryptionKey(env);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlToBytes(rawIv) },
      key,
      base64UrlToBytes(rawCiphertext),
    );
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "secret_invalid", "Não foi possível descriptografar a credencial do canal.");
  }
}
