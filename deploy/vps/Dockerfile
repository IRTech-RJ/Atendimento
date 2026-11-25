FROM node:24.22.3-bookworm-slim

WORKDIR /app
ENV WRANGLER_SEND_METRICS=false

COPY source/package*.json ./
RUN npm ci --no-audit --no-fund

COPY source/ ./
RUN npm run build \
    && install -d -o node -g node /app/.wrangler /app/dist/worker/.wrangler /data \
    && touch /app/dist/worker/.dev.vars
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && apt-get clean

USER node
EXPOSE 8787

CMD ["sh", "-ec", "\
    ./node_modules/.bin/wrangler d1 migrations apply atendimento-db --local --persist-to /data --config dist/worker/wrangler.json && \
    exec ./node_modules/.bin/wrangler dev --config dist/worker/wrangler.json --local --persist-to /data \
    --ip 0.0.0.0 --port 8787 --host atendimento.irtechoficial.com.br --upstream-protocol https \
    --no-live-reload --show-interactive-dev-session=false"]
