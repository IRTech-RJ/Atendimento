# IR Tech Atendimento

Plataforma SaaS de atendimento empresarial da IR Tech. Slogan: **Soluções inteligentes em tecnologia.**
O código da aplicação está sendo desenvolvido do zero; não usa Chatwoot, Docker, Firebase, Supabase,
WhatsApp Web ou serviço de atendimento de terceiros.

## Tecnologias

- **React + TypeScript + Vite** para a interface e desenvolvimento local.
- **Tailwind CSS** para estilos responsivos próprios.
- **Cloudflare Workers** para a API, executada localmente pelo plugin oficial do Vite.
- **Cloudflare D1 (SQLite)** para persistência relacional e migrações locais.
- **Cloudflare R2** reservado para arquivos (nenhum upload implementado).
- **Git + GitHub Actions** para versionamento; deploy automático permanece desativado.

Não é necessário instalar Docker. Git, Node.js e npm foram verificados neste ambiente.

## Estrutura

```text
src/
  components/   componentes de interface reutilizáveis
  data/         dados fictícios exclusivos da demonstração local
  layouts/      layouts administrativo e da empresa
  pages/        login e painéis
  services/     chamadas HTTP de autenticação
  styles/       Tailwind e estilos globais
  types/        tipos de domínio e API
worker/
  routes/       autenticação, administração e recursos por tenant
migrations/     migrações SQL do D1
scripts/        teste de integração da API
public/         arquivos estáticos
docs/           arquitetura e API local
```

## Executar localmente no Windows

No terminal do VS Code, na pasta do projeto:

```powershell
npm install
npm run db:migrate:local
Copy-Item .dev.vars.example .dev.vars
```

Edite `.dev.vars` e troque o valor de exemplo de `BOOTSTRAP_ADMIN_KEY` por uma chave aleatória
longa. Para gerar uma no terminal sem instalar nada:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Depois, inicie o sistema:

```powershell
npm run dev
```

Abra o endereço mostrado pelo Vite (normalmente `http://localhost:5173`). Na primeira visita,
escolha **Configurar o primeiro administrador**, informe a chave local, nome, e-mail e uma senha de
no mínimo 12 caracteres. Esse cadastro é permitido uma única vez por banco. Para a administração
IR Tech, use o espaço `ir-tech`; para usuários de empresa, use o identificador (`slug`) da empresa.

`.dev.vars` é local e ignorado pelo Git. Não envie essa chave para o GitHub. `.env.example` contém
somente configuração pública do frontend.

## Migrations e testes

```powershell
npm run db:migrate:local
npm run typecheck
npm run build
```

Para testar login, isolamento de tenants, permissões e recursos da API, defina as credenciais de um
administrador IR Tech existente no terminal sem gravá-las em arquivos:

```powershell
$env:TEST_ADMIN_EMAIL = Read-Host "E-mail do administrador IR Tech"
$secure = Read-Host "Senha do administrador IR Tech" -AsSecureString
$env:TEST_ADMIN_PASSWORD = (New-Object System.Net.NetworkCredential("", $secure)).Password
npm run test:api
Remove-Item Env:TEST_ADMIN_EMAIL, Env:TEST_ADMIN_PASSWORD
```

O teste cria empresas e registros fictícios e os exclui logicamente ao terminar. Para produção,
configure primeiro os IDs reais do D1 e do R2 e os segredos do Worker; só então aplique as migrações
remotas e publique o build.

## API implementada

- `GET /api/setup/status` e `POST /api/setup/platform-admin`: configuração única do administrador inicial.
- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`: sessões.
- `/api/admin/companies`: administração global de empresas; somente `platform_admin`.
- `/api/tenants/:tenantId/users`, `/departments`, `/contacts`, `/conversations`, `/tags`.
- `/api/tenants/:tenantId/conversations/:conversationId/messages` e associação de etiquetas.
- `/api/tenants/:tenantId/whatsapp`: configuração segura da Meta Cloud API.
- `/api/tenants/:tenantId/trial`: status do teste gratuito de 15 dias.
- `/api/webhooks/whatsapp`: recebimento de mensagens da Meta.

O trial começa na primeira conexão de canal e, após 15 dias, mantém os dados disponíveis para
consulta, bloqueando alterações e novas respostas. Telegram aparece como “Em breve” e não aceita
conexões ativas.

Detalhes de payloads, papéis e isolamento estão em [docs/api-local.md](docs/api-local.md).

## Segurança e isolamento

Senhas são verificadas com PBKDF2-HMAC-SHA-256 (600.000 iterações e salt aleatório); a senha em
texto puro não é persistida. As sessões usam token aleatório, armazenam somente SHA-256 do token e
utilizam cookie `HttpOnly`, `SameSite=Strict`, expiração de 12 horas e `Secure` em HTTPS.

O tenant é associado à sessão no backend. Os endpoints validam o tenant e a permissão antes de
consultar dados; IDs enviados pelo navegador não concedem acesso. Chaves estrangeiras compostas
também impedem associar registros de setores, conversas e mensagens a outra empresa. Empresas,
usuários, setores, contatos, conversas, mensagens e etiquetas usam exclusão lógica.

O sistema ainda precisa de limitação de tentativas de login, recuperação de senha, MFA e uma revisão
de segurança antes de uso comercial. WhatsApp Cloud API suporta troca de texto quando configurada
pela empresa; mídias, templates e chamadas não estão implementados.

## Cloudflare e GitHub

`wrangler.jsonc` ainda usa ID D1 de exemplo e nome de bucket reservado. Antes de publicar, confirme
os recursos reais da conta Cloudflare, configure os segredos `BOOTSTRAP_ADMIN_KEY`,
`WHATSAPP_APP_SECRET` e `DATA_ENCRYPTION_KEY`, aplique as migrações remotas e valide o deploy.

O workflow `.github/workflows/deploy.yml` é desativado por padrão. O deploy só pode ser habilitado
futuramente após configurar a conta e definir `CLOUDFLARE_DEPLOY_ENABLED=true` no GitHub.
