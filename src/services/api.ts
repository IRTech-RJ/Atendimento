import type { ApiHealth } from "../types/api";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

export async function getApiHealth(): Promise<ApiHealth> {
  const response = await fetch(`${apiBaseUrl}/health`);

  if (!response.ok) {
    throw new Error(`A API respondeu com o status ${response.status}.`);
  }

  return response.json() as Promise<ApiHealth>;
}
