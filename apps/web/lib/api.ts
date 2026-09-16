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

  const response = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  const json = (await response.json()) as Envelope<T>;
  if (!json.success) {
    throw new ApiError(json.error.code, json.error.message, response.status);
  }
  return json.data;
}
