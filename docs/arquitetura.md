# Arquitetura e isolamento multi-tenant

## Componentes

- `src/`: frontend React/TypeScript, Tailwind e cliente HTTP.
- `worker/`: API executada pelo Cloudflare Workers. `routes/auth.ts` trata sessões e bootstrap;
  `routes/companies.ts` restringe o painel global a `platform_admin`; `routes/tenant.ts` implementa
  os recursos com validação e autorização.
- `migrations/`: alterações incrementais do D1. A migração `0001` cria usuários, empresas, setores,
  sessões e associações; `0002` adiciona permissões por papel/usuário, contatos, conversas,
  mensagens e etiquetas.
- `scripts/test-api.mjs`: teste local que cria dados fictícios em duas empresas, verifica o isolamento
  e exclui logicamente as empresas de teste.

## Autenticação e autorização

O bootstrap do primeiro administrador exige o secret local `BOOTSTRAP_ADMIN_KEY` e pode ser feito uma
única vez por banco. Senhas são derivadas via Web Crypto PBKDF2-HMAC-SHA-256 com 600.000 iterações e
salt de 128 bits. Cada sessão usa token aleatório de 256 bits; o D1 guarda somente o hash SHA-256.
O cookie não é acessível a JavaScript, usa `SameSite=Strict`, expira em 12 horas e recebe `Secure`
em HTTPS. Requisições que alteram dados validam a origem.

Os papéis são `platform_admin`, `company_admin`, `supervisor` e `agent`. `role_permissions` define os
perfis; `user_permissions` aplica concessões/negações explícitas por usuário. `user_departments`
delimita o acesso de supervisores e atendentes aos setores, além da permissão de responder.

## Garantias de tenant

O backend valida a sessão antes de cada rota privada. Para usuário de empresa, o `tenant_id` da URL
precisa ser igual ao tenant da sessão; discrepâncias retornam 404. O `platform_admin` tem acesso
administrativo global. SQL usa bindings preparados e sempre inclui `tenant_id` nas operações
multiempresa.

As chaves estrangeiras compostas de `user_departments`, `conversations`, `messages` e
`conversation_tags` exigem que registros relacionados pertençam ao mesmo tenant. Operações DELETE
marcam `deleted_at` e preservam o histórico. O login ignora usuários excluídos/inativos e empresas
bloqueadas.

## Limitações deliberadas desta etapa

- Não há recuperação de senha, limitação de tentativas, MFA ou auditoria detalhada de alterações.
- A UI anterior de demonstração permanece disponível apenas em desenvolvimento; as telas CRUD
  autenticadas já conectam empresas, usuários e setores ao D1. A central de conversas atualiza as
  mensagens a cada cinco segundos; contatos e etiquetas ainda não têm telas próprias.
- Sem uma conta WhatsApp configurada, mensagens continuam como registros locais.
- A integração inicial da WhatsApp Cloud API suporta texto inbound/outbound e status de entrega.
  O access token é criptografado no D1. Templates, mídias e chamadas ainda não foram implementados.
- O trial começa na primeira conexão de canal, dura 15 dias e depois deixa o tenant em modo de
  consulta; mensagens recebidas por webhook também deixam de ser processadas após o vencimento.
- Telegram é exibido como “Em breve”; suas rotas de conexão e webhook não estão habilitadas.
- O D1 remoto, o bucket R2, domínio e deploy não foram configurados nem acessados.

Antes do uso comercial, revisar segurança, configurar limites de login e revisar fluxo de
provisionamento de usuários. O estágio seguinte de produto pode implementar as telas de operação
para contatos e conversas e, depois, ampliar os canais oficiais mediante autorização.
