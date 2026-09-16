export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Envelope<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (typeof window !== "undefined") {
    const organizationId = window.localStorage.getItem("niva_organization_id");
    if (organizationId) {
      headers.set("x-organization-id", organizationId);
    }
    const restaurantId = window.localStorage.getItem("niva_restaurant_id");
    if (restaurantId) {
      headers.set("x-restaurant-id", restaurantId);
    }
    const branchId = window.localStorage.getItem("niva_branch_id");
    if (branchId) {
      headers.set("x-branch-id", branchId);
    }
  }

  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
  } catch {
    throw new ApiError(
      "UNAVAILABLE",
      "Cannot reach the API. Start it with pnpm dev:api (port 3001).",
      503,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  if (!contentType.includes("application/json")) {
    throw new ApiError(
      "UNAVAILABLE",
      "Cannot reach the API. Start it with pnpm dev:api (port 3001).",
      response.status || 503,
    );
  }

  let json: Envelope<T>;
  try {
    json = JSON.parse(body) as Envelope<T>;
  } catch {
    throw new ApiError(
      "UNAVAILABLE",
      "Cannot reach the API. Start it with pnpm dev:api (port 3001).",
      response.status || 503,
    );
  }

  if (!json.success) {
    throw new ApiError(json.error.code, json.error.message, response.status);
  }
  return json.data;
}
