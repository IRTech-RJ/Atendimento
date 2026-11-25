export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      {
        status: error.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  console.error("Unhandled API error", error);
  return Response.json(
    { error: { code: "internal_error", message: "Ocorreu um erro interno." } },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}
