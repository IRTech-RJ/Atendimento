export type WorkspaceMode = "admin" | "company";

export type CompanyStatus = "Ativa" | "Bloqueada";
export type RecordStatus = "Ativo" | "Inativo";
export type UserRole = "Administrador" | "Supervisor" | "Atendente";

export interface Company {
  id: string;
  name: string;
  document: string;
  segment: string;
  city: string;
  status: CompanyStatus;
}

export interface WorkspaceUser {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: string;
  status: RecordStatus;
}

export interface Department {
  id: string;
  companyId: string;
  name: string;
  description: string;
  status: RecordStatus;
}

export type ConversationStatus = "Aberta" | "Pendente" | "Resolvida";

export interface DemoMessage {
  id: string;
  from: "contact" | "agent";
  body: string;
  time: string;
}

export interface DemoConversation {
  id: string;
  companyId: string;
  contactName: string;
  contactPhone: string;
  initials: string;
  department: string;
  assignee: string;
  subject: string;
  status: ConversationStatus;
  unread: number;
  lastTime: string;
  messages: DemoMessage[];
}

export interface DemoContact {
  id: string;
  companyId: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  lastContact: string;
  tags: string[];
}

export type AdminSection = "overview" | "companies" | "users" | "departments";
export type CompanySection =
  | "overview"
  | "users"
  | "departments"
  | "whatsapp"
  | "conversations"
  | "contacts";
