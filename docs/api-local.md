# API local

Todas as rotas abaixo são servidas pelo Worker local em `http://localhost:5173`. Corpos de escrita
devem usar JSON; requisições que alteram dados precisam enviar `Origin` igual à origem da aplicação.
O cliente do navegador já faz isso.

## Primeiro administrador e login

1. Configure uma chave aleatória em `.dev.vars`:

   ```text
   BOOTSTRAP_ADMIN_KEY=uma-chave-local-aleatoria
   ```

2. `GET /api/setup/status` informa se o banco ainda precisa do administrador inicial.
3. Faça `POST /api/setup/platform-admin` uma única vez com:

   ```json
   {
     "key": "a chave local",
     "name": "Administrador IR Tech",
     "email": "admin@exemplo.test",
     "password": "uma senha com 12 ou mais caracteres"
   }
   ```

   A resposta cria uma sessão no cookie `irtech_session`. A chave não é gravada no banco e o
   bootstrap passa a retornar conflito depois do primeiro cadastro.

4. `POST /api/auth/login` recebe `{ "workspace": "ir-tech", "email": "...", "password": "..." }`
   para o administrador global. Para usuários de empresa, use o `slug` da empresa no campo
   `workspace`.
5. `GET /api/auth/me` devolve o usuário da sessão ou `{ "user": null }` se não houver uma sessão
   ativa; `POST /api/auth/logout` revoga a sessão atual.

## Administração global

Somente `platform_admin` pode chamar `/api/admin/companies`:

- `GET` lista empresas não excluídas.
- `POST` cadastra uma empresa (`name`, `segment`, `city`, opcional `slug` e `document`).
- `GET /:companyId` e `PATCH /:companyId` consultam/alteram dados.
- `DELETE /:companyId` bloqueia e marca exclusão lógica.
- `POST /:companyId/restore` remove a marca de exclusão; o status bloqueado continua independente.

## Recursos do tenant

Rotas `/api/tenants/:tenantId/...` verificam a sessão e a permissão no Worker. Um usuário de empresa
que tentar usar outro `tenantId` recebe 404.

- `users`: consultar/criar/alterar/excluir logicamente usuários; `GET/PUT /:userId/permissions`
  controla permissões individuais `company.*`.
- `departments`: consultar/criar/alterar/excluir logicamente setores.
- `contacts`: consultar/criar/alterar/excluir logicamente contatos; telefone validado e único por
  empresa enquanto ativo.
- `conversations`: consultar/criar/alterar/excluir logicamente conversas; contato, setor e atendente
  devem pertencer ao mesmo tenant.
- `conversations/:id/messages`: lista mensagens e registra notas internas/respostas no D1. Registrar
  uma resposta **não envia** WhatsApp.
- `tags`: consultar/criar/alterar/excluir logicamente etiquetas. `conversations/:id/tags` associa
  etiquetas a uma conversa do mesmo tenant.

`agent` e `supervisor` só listam conversas dos setores associados com `can_view_conversations=1`.
Responder exige o papel/permissão correspondente e `can_reply=1`. `company_admin` gerencia os
recursos da própria empresa; `platform_admin` pode administrá-los em qualquer empresa.

## WhatsApp Cloud API

- Configure `WHATSAPP_APP_SECRET` em `.dev.vars` para validar assinaturas dos webhooks.
- Configure `WHATSAPP_DATA_ENCRYPTION_KEY` com uma chave aleatória e estável para criptografar
  o access token no D1. Não altere esta chave após cadastrar uma conta.
- O access token pode ser configurado na tela **WhatsApp** da empresa ou por API.
- `PUT /api/tenants/:tenantId/whatsapp` cadastra `phoneNumberId`, `accessToken`, `verifyToken` e
  `defaultDepartmentId`. `GET` consulta a configuração sem retornar o access token; `DELETE` remove.
- A Meta deve chamar `GET/POST /api/webhooks/whatsapp`. O GET usa `verifyToken`; o POST recebe textos,
  cria contato/conversa quando necessário e grava mensagens inbound.
- Enviar uma mensagem `outbound` usa a Cloud API quando a conta está habilitada. Sem configuração,
  a mensagem continua sendo registrada apenas localmente.
- Suporte inicial: texto, verificação de assinatura, idempotência pelo WAMID e status de entrega.
  Templates, mídias e chamadas ainda não estão implementados.

Falhas retornam JSON estável `{ "error": { "code": "...", "message": "..." } }` com status HTTP
apropriado; senhas e hashes nunca são incluídos nas respostas.
