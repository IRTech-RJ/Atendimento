# IR Tech Atendimento

Plataforma SaaS de atendimento empresarial da IR Tech. Slogan: **Soluções inteligentes em tecnologia.**
O código da aplicação está sendo desenvolvido do zero; não usa Chatwoot, Docker, Firebase, Supabase,
WhatsApp Web ou serviço de atendimento de terceiros.

## Arquitetura escolhida

- **React + TypeScript + Vite:** interface web tipada e ambiente de desenvolvimento rápido.
- **Tailwind CSS:** estilos responsivos sem depender de um kit visual pronto.
- **Cloudflare Workers + Vite plugin oficial:** API e frontend no mesmo projeto e runtime local próximo ao de produção.
- **Cloudflare D1 (SQLite):** dados relacionais de empresas, usuários, setores, permissões e sessões.
- **Cloudflare R2:** binding preparado para arquivos; integração de upload ainda não implementada.
- **Git + GitHub Actions:** versionamento e pipeline de deploy preparados, sem conectar contas.

Não é necessário instalar Docker. Git e Node.js/npm foram verificados neste ambiente.

## Estrutura

```text
src/
  components/   componentes de interface reutilizáveis
  data/         dados fictícios exclusivos da demonstração local
  layouts/      layouts administrativo e da empresa
  pages/        login e painéis
  styles/       Tailwind e estilos globais
  types/        tipos de domínio e API
worker/         entrada da API Cloudflare Workers
migrations/     migrações SQL do D1
public/         arquivos estáticos
docs/           arquitetura e decisões técnicas
.github/
  workflows/    deploy opcional e desativado por padrão
```

## Executar localmente no Windows

No terminal do VS Code, na pasta do projeto:

```powershell
npm install
npm run dev
```

Abra no navegador o endereço local mostrado no terminal (normalmente `http://localhost:5173`).
Na tela inicial, escolha **Painel IR Tech** ou **Espaço da empresa** para percorrer a demonstração.
O endpoint de diagnóstico local é `/api/health`.

Os cadastros da demonstração são apenas dados fictícios em memória: eles não são gravados no D1 e
desaparecem ao recarregar a página. O acesso por e-mail e senha está desativado; os botões de
demonstração não autenticam usuários.

## Comandos

| Comando | Uso |
| --- | --- |
| `npm run dev` | Inicia o Vite e o Worker local |
| `npm run typecheck` | Verifica os tipos TypeScript |
| `npm run build` | Verifica os tipos e gera o build |
| `npm run preview` | Gera o build e executa uma prévia local |
| `npm run db:migrate:local` | Aplica migrações no D1 local |
| `npm run db:migrate:remote` | Aplica migrações no D1 remoto |
| `npm run deploy` | Gera o build e publica no Cloudflare |

`migrations/0001_initial.sql` define empresas, usuários, setores, associações de permissão por
setor e sessões. Chaves estrangeiras compostas impedem associar um usuário a setor de outro tenant.
As tabelas não representam uma autenticação pronta: o login, o hash de senha e a gestão segura de
sessões ainda precisam ser implementados antes de usar dados reais.

## Configuração Cloudflare

`wrangler.jsonc` configura o Worker, o fallback SPA, o binding D1 (`DB`) e o binding R2 (`MEDIA`).
O ID D1 é um valor de exemplo e o bucket não foi criado. Para desenvolvimento local, o Wrangler
emula os bindings; `npm run db:migrate:local` cria o banco local e aplica a migração.

Não rode `db:migrate:remote` nem `deploy` sem antes configurar sua conta e autorizar a operação.
Nenhum recurso ou serviço externo foi criado/conectado neste projeto.

`.env.example` contém apenas uma URL pública do frontend. Valores `VITE_*` são enviados ao navegador
e nunca devem conter credenciais. Segredos locais devem ficar em `.dev.vars` (ignorado pelo Git);
segredos remotos devem ser cadastrados como secrets no Wrangler.

## GitHub Actions

`.github/workflows/deploy.yml` pode publicar na branch `master`, mas está **desativado por padrão**.
Para habilitá-lo futuramente, configure os segredos `CLOUDFLARE_API_TOKEN` e
`CLOUDFLARE_ACCOUNT_ID`, configure D1/R2 e defina a variável do repositório
`CLOUDFLARE_DEPLOY_ENABLED` como `true`. Se a branch principal do futuro repositório for renomeada,
ajuste o gatilho do workflow para refletir o novo nome.

## Escopo desta etapa e limitações

- A tela de login e os painéis são uma demonstração de interface, não um produto com autenticação.
- Os cadastros demonstrativos não são persistidos. As APIs de empresas, usuários e setores ainda não
  estão conectadas.
- Integração oficial WhatsApp Business Platform, conversas, pedidos/delivery, planos/assinaturas,
  domínio próprio e PWA ficam para etapas seguintes.
- Não há envio/recebimento de WhatsApp nem automação simulada.

Consulte [docs/arquitetura.md](docs/arquitetura.md) para detalhes do isolamento multi-tenant e
próximas decisões.
