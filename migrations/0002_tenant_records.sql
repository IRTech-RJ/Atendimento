ALTER TABLE companies ADD COLUMN deleted_at TEXT;
ALTER TABLE users ADD COLUMN deleted_at TEXT;
ALTER TABLE departments ADD COLUMN deleted_at TEXT;

CREATE TABLE roles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('platform', 'tenant'))
);

CREATE TABLE permissions (
  id TEXT PRIMARY KEY NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_permissions (
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  allowed INTEGER NOT NULL CHECK (allowed IN (0, 1)),
  PRIMARY KEY (tenant_id, user_id, permission_id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE CASCADE
);

INSERT INTO roles (id, name, scope) VALUES
  ('platform_admin', 'Administrador IR Tech', 'platform'),
  ('company_admin', 'Administrador da empresa', 'tenant'),
  ('supervisor', 'Supervisor', 'tenant'),
  ('agent', 'Atendente', 'tenant');

INSERT INTO permissions (id, description) VALUES
  ('companies.manage', 'Administrar empresas da plataforma'),
  ('company.users.manage', 'Administrar usuários da empresa'),
  ('company.departments.manage', 'Administrar setores e associações'),
  ('company.contacts.read', 'Consultar contatos da empresa'),
  ('company.contacts.manage', 'Cadastrar e alterar contatos'),
  ('company.conversations.read', 'Consultar conversas permitidas'),
  ('company.conversations.manage', 'Criar e alterar conversas'),
  ('company.messages.read', 'Consultar mensagens de conversas permitidas'),
  ('company.messages.reply', 'Registrar respostas nas conversas permitidas'),
  ('company.messages.delete', 'Excluir logicamente mensagens'),
  ('company.tags.manage', 'Administrar etiquetas e associações');

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'platform_admin', id FROM permissions;

INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('company_admin', 'company.users.manage'),
  ('company_admin', 'company.departments.manage'),
  ('company_admin', 'company.contacts.read'),
  ('company_admin', 'company.contacts.manage'),
  ('company_admin', 'company.conversations.read'),
  ('company_admin', 'company.conversations.manage'),
  ('company_admin', 'company.messages.read'),
  ('company_admin', 'company.messages.reply'),
  ('company_admin', 'company.messages.delete'),
  ('company_admin', 'company.tags.manage'),
  ('supervisor', 'company.contacts.read'),
  ('supervisor', 'company.contacts.manage'),
  ('supervisor', 'company.conversations.read'),
  ('supervisor', 'company.conversations.manage'),
  ('supervisor', 'company.messages.read'),
  ('supervisor', 'company.messages.reply'),
  ('supervisor', 'company.tags.manage'),
  ('agent', 'company.contacts.read'),
  ('agent', 'company.conversations.read'),
  ('agent', 'company.messages.read'),
  ('agent', 'company.messages.reply');

CREATE TABLE platform_bootstrap (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  admin_id TEXT NOT NULL UNIQUE,
  completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE contacts (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  PRIMARY KEY (tenant_id, id)
);

CREATE UNIQUE INDEX contacts_tenant_phone_active_idx
  ON contacts(tenant_id, phone) WHERE deleted_at IS NULL;

CREATE TABLE conversations (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL,
  department_id TEXT NOT NULL,
  assigned_user_id TEXT,
  subject TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts(tenant_id, id),
  FOREIGN KEY (tenant_id, department_id) REFERENCES departments(tenant_id, id),
  FOREIGN KEY (tenant_id, assigned_user_id) REFERENCES users(tenant_id, id)
);

CREATE INDEX conversations_tenant_status_idx
  ON conversations(tenant_id, status, updated_at) WHERE deleted_at IS NULL;
CREATE INDEX conversations_tenant_department_idx
  ON conversations(tenant_id, department_id, updated_at) WHERE deleted_at IS NULL;
CREATE INDEX conversations_tenant_contact_idx
  ON conversations(tenant_id, contact_id) WHERE deleted_at IS NULL;

CREATE TABLE messages (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  sender_user_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound', 'internal')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, conversation_id) REFERENCES conversations(tenant_id, id),
  FOREIGN KEY (tenant_id, sender_user_id) REFERENCES users(tenant_id, id)
);

CREATE INDEX messages_conversation_created_idx
  ON messages(tenant_id, conversation_id, created_at) WHERE deleted_at IS NULL;

CREATE TABLE tags (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#0f766e',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  PRIMARY KEY (tenant_id, id)
);

CREATE UNIQUE INDEX tags_tenant_name_active_idx
  ON tags(tenant_id, name) WHERE deleted_at IS NULL;

CREATE TABLE conversation_tags (
  tenant_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (tenant_id, conversation_id, tag_id),
  FOREIGN KEY (tenant_id, conversation_id) REFERENCES conversations(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, tag_id) REFERENCES tags(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX user_permissions_lookup_idx
  ON user_permissions(tenant_id, user_id, permission_id);
