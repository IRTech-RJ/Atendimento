interface Env {
  APP_ENV: string;
  DB: D1Database;
  MEDIA: R2Bucket;
}

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health" && request.method === "GET") {
      return Response.json(
        {
          status: "ok",
          service: "atendimento-api",
          timestamp: new Date().toISOString(),
        },
        { headers: jsonHeaders },
      );
    }

    if (url.pathname.startsWith("/api/")) {
      return Response.json(
        { error: "Rota da API não encontrada." },
        { status: 404, headers: jsonHeaders },
      );
    }

    return new Response("Not found", { status: 404 });
  },
};
