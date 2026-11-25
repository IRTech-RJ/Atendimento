import { useState } from "react";
import { demoCompanies, demoContacts, demoConversations, demoDepartments, demoUsers } from "../data/demoData";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { AdminDashboardPage } from "../pages/AdminDashboardPage";
import { CompaniesPage } from "../pages/CompaniesPage";
import { CompanyDashboardPage } from "../pages/CompanyDashboardPage";
import { DepartmentsPage } from "../pages/DepartmentsPage";
import { UsersPage } from "../pages/UsersPage";
import { DemoConversationsPage } from "../pages/DemoConversationsPage";
import { DemoContactsPage } from "../pages/DemoContactsPage";
import type {
  AdminSection,
  CompanySection,
  Company as CompanyRecord,
  Department,
  WorkspaceMode,
  WorkspaceUser,
} from "../types/workspace";

interface WorkspaceProps {
  mode: WorkspaceMode;
  onLogout: () => void;
}

export function Workspace({ mode, onLogout }: WorkspaceProps) {
  const [adminSection, setAdminSection] = useState<AdminSection>("overview");
  const [companySection, setCompanySection] = useState<CompanySection>("overview");
  const [companies, setCompanies] = useState(demoCompanies);
  const [users, setUsers] = useState(demoUsers);
  const [departments, setDepartments] = useState(demoDepartments);
  const company = companies.find((item) => item.id === "company-aurora") ?? companies[0];
  const section = mode === "admin" ? adminSection : companySection;

  function navigate(nextSection: AdminSection | CompanySection) {
    if (mode === "admin") setAdminSection(nextSection as AdminSection);
    else setCompanySection(nextSection as CompanySection);
  }

  function saveCompany(companyRecord: CompanyRecord) {
    setCompanies((current) =>
      current.some((item) => item.id === companyRecord.id)
        ? current.map((item) => (item.id === companyRecord.id ? companyRecord : item))
        : [companyRecord, ...current],
    );
  }

  function toggleCompanyStatus(id: string) {
    setCompanies((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: item.status === "Ativa" ? "Bloqueada" : "Ativa" } : item,
      ),
    );
  }

  function saveUser(user: WorkspaceUser) {
    setUsers((current) =>
      current.some((item) => item.id === user.id)
        ? current.map((item) => (item.id === user.id ? user : item))
        : [user, ...current],
    );
  }

  function toggleUserStatus(id: string) {
    setUsers((current) =>
      current.map((item) => (item.id === id ? { ...item, status: item.status === "Ativo" ? "Inativo" : "Ativo" } : item)),
    );
  }

  function saveDepartment(department: Department) {
    setDepartments((current) =>
      current.some((item) => item.id === department.id)
        ? current.map((item) => (item.id === department.id ? department : item))
        : [department, ...current],
    );
  }

  function toggleDepartmentStatus(id: string) {
    setDepartments((current) =>
      current.map((item) => (item.id === id ? { ...item, status: item.status === "Ativo" ? "Inativo" : "Ativo" } : item)),
    );
  }

  const content = mode === "admin" ? (
    <>
      {adminSection === "overview" && (
        <AdminDashboardPage
          companies={companies}
          users={users}
          departments={departments}
          onNavigate={setAdminSection}
        />
      )}
      {adminSection === "companies" && (
        <CompaniesPage companies={companies} onSave={saveCompany} onToggleStatus={toggleCompanyStatus} />
      )}
      {adminSection === "users" && (
        <UsersPage
          users={users}
          companies={companies}
          departments={departments}
          onSave={saveUser}
          onToggleStatus={toggleUserStatus}
        />
      )}
      {adminSection === "departments" && (
        <DepartmentsPage
          departments={departments}
          companies={companies}
          onSave={saveDepartment}
          onToggleStatus={toggleDepartmentStatus}
        />
      )}
    </>
  ) : company ? (
    <>
      {companySection === "overview" && (
        <CompanyDashboardPage
          company={company}
          users={users}
          departments={departments}
          onNavigate={setCompanySection}
        />
      )}
      {companySection === "users" && (
        <UsersPage
          users={users}
          companies={companies}
          departments={departments}
          companyId={company.id}
          onSave={saveUser}
          onToggleStatus={toggleUserStatus}
        />
      )}
      {companySection === "departments" && (
        <DepartmentsPage
          departments={departments}
          companies={companies}
          companyId={company.id}
          onSave={saveDepartment}
          onToggleStatus={toggleDepartmentStatus}
        />
      )}
      {companySection === "conversations" && (
        <DemoConversationsPage
          conversations={demoConversations.filter((conversation) => conversation.companyId === company.id)}
        />
      )}
      {companySection === "contacts" && (
        <DemoContactsPage
          contacts={demoContacts.filter((contact) => contact.companyId === company.id)}
        />
      )}
    </>
  ) : (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
      Cadastre uma empresa na demonstração para visualizar este espaço.
    </div>
  );

  return (
    <WorkspaceLayout
      mode={mode}
      section={section}
      onNavigate={navigate}
      onLogout={onLogout}
      companyName={company?.name}
    >
      {content}
    </WorkspaceLayout>
  );
}
