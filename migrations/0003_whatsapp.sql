ALTER TABLE messages ADD COLUMN provider TEXT NOT NULL DEFAULT 'local';
ALTER TABLE messages ADD COLUMN provider_external_id TEXT;
ALTER TABLE messages ADD COLUMN provider_status TEXT;

CREATE UNIQUE INDEX messages_provider_external_idx
  ON messages(provider, provider_external_id)
  WHERE provider_external_id IS NOT NULL;

CREATE TABLE whatsapp_accounts (
  tenant_id TEXT PRIMARY KEY NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  phone_number_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  verify_token TEXT NOT NULL,
  default_department_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id, default_department_id)
    REFERENCES departments(tenant_id, id) ON DELETE RESTRICT
);
