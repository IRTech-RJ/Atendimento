# Ambiente de testes na VPS

## Onde retomar

- Em 25/11/2026, a versão `9e2b1e7` foi publicada. A interface, os arquivos estáticos, a API e o certificado HTTPS foram verificados. O administrador inicial já foi cadastrado. Entre no espaço `ir-tech` com uma conta administrativa. [Atendimento online](https://atendimento.irtechoficial.com.br/)
- As sete migrações, a compilação e o teste de integração da API passaram. Em um banco local separado, um evento simulado do WhatsApp criou o contato e a conversa no setor configurado. Repetir o evento manteve uma só mensagem.
- O próximo marco é receber um texto de um celular real em **Conversas** e enviar uma resposta pelo painel. A troca com um número real ainda está pendente.

## Teste com o número de demonstração da Meta

1. No espaço `ir-tech`, crie ou selecione uma empresa de teste. Cadastre um setor de atendimento e um administrador da empresa. Abra o espaço da empresa usando o identificador dela no login.
2. Em um app de teste da Meta, selecione o número de teste, adicione um celular autorizado como destinatário e gere um token de acesso. Na empresa, abra **Canais → Conectar Meta Cloud API**. Preencha o **Phone Number ID**, o token de acesso, o setor padrão e um token de verificação escolhido para o webhook. [Guia de teste da Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started/)
3. Na VPS, adicione o App Secret da Meta como `WHATSAPP_APP_SECRET` no arquivo protegido `/opt/atendimento-staging/.dev.vars`. Mantenha o valor de `DATA_ENCRYPTION_KEY` para preservar o acesso aos tokens já salvos. A partir de `/opt/atendimento-staging`, execute `docker compose restart app` para recarregar os valores.
4. No painel da Meta, configure a URL abaixo e use o mesmo token de verificação informado em **Canais**. Assine o evento `messages` para a conta de teste. Envie a primeira mensagem pelo painel da Meta e responda pelo celular. Confirme a chegada em **Conversas** e responda por lá para conferir a entrega no celular. [Rota do webhook](https://atendimento.irtechoficial.com.br/api/webhooks/whatsapp)

## Como a VPS está organizada

A VPS usa Docker para executar o build da interface e o Worker em modo local. O D1 de teste persiste em `/data`, montado no volume `atendimento-staging_data`. A aplicação escuta na porta `8787` do contêiner e em `127.0.0.1:18787` na VPS. O Caddy existente termina HTTPS e encaminha o tráfego pela rede `atendimento_staging_edge`.

O checkout do Git fica em `/opt/atendimento-staging/source`. Os arquivos de operação ficam em `/opt/atendimento-staging`. O Caddy lê `/opt/dp-license-https/Caddyfile`, que contém o bloco do Atendimento. [Arquivos da VPS](../deploy/vps/), [Bloco do Caddy](../deploy/vps/Caddyfile.atendimento)

## Atualizar e verificar

Com acesso SSH à VPS, faça o backup do banco de teste antes de publicar uma versão com migrações. Depois, execute os comandos abaixo.

```sh
cd /opt/atendimento-staging
git -C source pull --ff-only origin master
cp source/deploy/vps/Dockerfile source/deploy/vps/.dockerignore source/deploy/vps/compose.yml .
export ATENDIMENTO_IMAGE_TAG="$(git -C source rev-parse --short HEAD)"
docker compose config --quiet
docker compose up -d --build
docker compose ps
curl -fsS https://atendimento.irtechoficial.com.br/api/health
```

O build usa o `package-lock.json` e o contêiner aplica as migrações pendentes no volume existente ao iniciar. Mantenha o `.dev.vars` no diretório de operação da VPS, com permissões `0440` e grupo `1000`, para leitura pelo usuário Node do contêiner. Guarde os segredos fora do repositório e preserve o volume ao recriar o contêiner.

Se o proxy `dp_license_https` for recriado, confira se ele continua conectado à rede `atendimento_staging_edge`. Para reconectá-lo, execute `docker network connect atendimento_staging_edge dp_license_https`. Valide o Caddy antes de recarregar alterações de configuração.

```sh
docker exec dp_license_https caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec dp_license_https caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```
