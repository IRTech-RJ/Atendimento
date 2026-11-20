# Arquitetura e plano por etapas

## Stack

React, TypeScript, Vite e Tailwind CSS no frontend. O Worker, executado pelo plugin oficial
`@cloudflare/vite-plugin`, será a API. D1 é o banco relacional; R2 fica reservado para arquivos.
Esse arranjo não exige Docker e pode ser desenvolvido localmente antes de criar recursos Cloudflare.

## Isolamento multi-tenant

`companies` representa cada empresa. Usuários de empresa carregam `tenant_id`; administradores da
plataforma têm `tenant_id` nulo. Setores também carregam `tenant_id`. A tabela `user_departments`
usa chaves estrangeiras compostas com `tenant_id`, impedindo que uma associação ligue usuário e
setor de empresas diferentes. Toda consulta futura de dados de empresa deverá derivar o tenant da
sessão autenticada e filtrar pelo `tenant_id`; nunca aceitar esse escopo do navegador como prova de
autorização.

## Pastas

- `src/components`, `src/pages`, `src/layouts`: interface própria, sem kit de atendimento de terceiros.
- `src/data`: dados fictícios usados somente pela demonstração de interface.
- `src/services`, `src/hooks`, `src/types`, `src/styles`: integração, lógica compartilhada, tipos e estilos.
- `worker`: entrada HTTP do Worker; atualmente oferece somente `/api/health`.
- `migrations`: histórico SQL aplicado ao D1.
- `public`: arquivos estáticos.

## Segurança e limitações atuais

A demonstração não realiza login e os botões de acesso não autenticam ninguém. O cadastro de
usuários na interface não gera credenciais. As tabelas `users` e `sessions` definem apenas a base de
dados — não há código de hash de senhas, criação/validação de sessão ou autorização implementado.
Não use os dados demonstrativos como sistema real nem conecte um canal WhatsApp.

Antes de habilitar usuários reais, a etapa seguinte deverá implementar hash de senha compatível com
Workers (por exemplo, PBKDF2 via Web Crypto ou biblioteca revisada), tokens de sessão aleatórios com
apenas o hash persistido, cookies `HttpOnly`, `Secure`, `SameSite`, expiração/revogação e middleware
que imponha funções e tenant em cada endpoint. Senhas em texto puro não devem ser persistidas.

O domínio, a integração Cloud API da Meta, o bucket R2, o PWA e o deploy externo não foram criados
ou configurados. A migração D1 é estrutura inicial; não contém usuários nem dados reais.

## Etapas sugeridas

1. Validar visualmente o painel e a navegação no modo demonstração.
2. Implementar autenticação, bootstrap seguro do primeiro administrador e autorização no Worker.
3. Conectar cadastros de empresas, usuários, papéis/permissões e setores ao D1, com testes de
   isolamento entre tenants.
4. Desenvolver caixa de entrada e integração oficial WhatsApp Cloud API.
5. Desenvolver pedidos de delivery, configurações, PWA e planos conforme as regras do produto.
6. Configurar recursos Cloudflare e CI/CD somente após autorização expressa.
