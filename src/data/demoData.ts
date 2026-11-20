import type { Company, Department, WorkspaceUser } from "../types/workspace";

export const demoCompanies: Company[] = [
  {
    id: "company-aurora",
    name: "Mercado Aurora",
    document: "00.000.000/0001-00",
    segment: "Supermercado",
    city: "Campinas, SP",
    status: "Ativa",
  },
  {
    id: "company-viva",
    name: "Viva Casa & Decor",
    document: "11.111.111/0001-11",
    segment: "Varejo",
    city: "Jundiaí, SP",
    status: "Ativa",
  },
  {
    id: "company-ponto",
    name: "Ponto do Bairro",
    document: "22.222.222/0001-22",
    segment: "Comércio",
    city: "Sorocaba, SP",
    status: "Bloqueada",
  },
];

export const demoDepartments: Department[] = [
  { id: "department-delivery", companyId: "company-aurora", name: "Delivery", description: "Pedidos e entregas", status: "Ativo" },
  { id: "department-finance", companyId: "company-aurora", name: "Financeiro", description: "Pagamentos e notas fiscais", status: "Ativo" },
  { id: "department-support", companyId: "company-aurora", name: "Atendimento", description: "Dúvidas e suporte geral", status: "Ativo" },
  { id: "department-vendas", companyId: "company-viva", name: "Vendas", description: "Dúvidas sobre produtos", status: "Ativo" },
];

export const demoUsers: WorkspaceUser[] = [
  {
    id: "user-ana",
    companyId: "company-aurora",
    name: "Ana Martins",
    email: "ana@mercadoaurora.example",
    role: "Administrador",
    departmentId: "department-delivery",
    status: "Ativo",
  },
  {
    id: "user-lucas",
    companyId: "company-aurora",
    name: "Lucas Ribeiro",
    email: "lucas@mercadoaurora.example",
    role: "Atendente",
    departmentId: "department-support",
    status: "Ativo",
  },
  {
    id: "user-marina",
    companyId: "company-viva",
    name: "Marina Costa",
    email: "marina@vivacasa.example",
    role: "Supervisor",
    departmentId: "department-vendas",
    status: "Ativo",
  },
];
