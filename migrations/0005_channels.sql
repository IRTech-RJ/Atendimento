ALTER TABLE whatsapp_accounts ADD COLUMN display_name TEXT NOT NULL DEFAULT 'WhatsApp';

ALTER TABLE contacts ADD COLUMN provider TEXT NOT NULL DEFAULT 'local';
ALTER TABLE contacts ADD COLUMN provider_external_id TEXT;

CREATE UNIQUE INDEX contacts_provider_external_idx
  ON contacts(tenant_id, provider, provider_external_id)
  WHERE provider_external_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE telegram_accounts (
  tenant_id TEXT PRIMARY KEY NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  bot_token_encrypted TEXT NOT NULL,
  bot_username TEXT NOT NULL,
  webhook_secret_hash TEXT NOT NULL UNIQUE,
  default_department_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id, default_department_id)
    REFERENCES departments(tenant_id, id) ON DELETE RESTRICT
);
