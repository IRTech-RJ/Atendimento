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

export type AdminSection = "overview" | "companies" | "users" | "departments";
export type CompanySection = "overview" | "users" | "departments";
