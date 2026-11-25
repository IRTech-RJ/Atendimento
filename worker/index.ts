import { requirePlatformAdmin } from "./authorization";
import type { WorkerEnv } from "./authorization";
import { errorResponse, ApiError } from "./errors";
import { json, requireSameOrigin } from "./http";
import { handleAuthRoutes } from "./routes/auth";
import { handleCompanyRoutes } from "./routes/companies";
import { handleTenantRoutes } from "./routes/tenant";
import { handleWhatsAppWebhook } from "./routes/whatsapp";
import { currentUser, requireAuthenticated } from "./security";

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/api/health" && request.method === "GET") {
        return json({
          status: "ok",
          service: "atendimento-api",
          timestamp: new Date().toISOString(),
        });
      }

      const whatsappWebhook = await handleWhatsAppWebhook(request, env);
      if (whatsappWebhook) return whatsappWebhook;

      if (!url.pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });

      const publicRoute = await handleAuthRoutes(request, env);
      if (publicRoute) return publicRoute;

      if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
        requireSameOrigin(request);
      }

      const user = requireAuthenticated(await currentUser(env.DB, request));
      const companyResponse = await handleCompanyRoutes(request, env, user);
      if (companyResponse) return companyResponse;

      const tenantResponse = await handleTenantRoutes(request, env, user);
      if (tenantResponse) return tenantResponse;

      if (url.pathname === "/api/admin/me" && request.method === "GET") {
        await requirePlatformAdmin(user);
        return json({ user });
      }

      throw new ApiError(404, "not_found", "Rota da API não encontrada.");
    } catch (error) {
      return errorResponse(error);
    }
  },
};
