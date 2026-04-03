const API_BASE = import.meta.env.VITE_API_URL || "/api";

export class ApiError extends Error {
  constructor(message, { status, payload, code } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.code = code || null;
  }
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof payload === "object" && payload?.error
      ? payload.error
      : `Request failed (${response.status})`;
    throw new ApiError(message, {
      status: response.status,
      payload,
      code: typeof payload === "object" ? payload?.code : null,
    });
  }

  return payload;
}

export async function apiFetch(path, { method = "GET", body, token } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return parseResponse(response);
}

export function getApiErrorMessage(error, t, fallbackPath = "common.unexpectedError") {
  if (error?.code) {
    const localizedByCode = t(`apiErrors.${error.code}`);
    if (localizedByCode !== `apiErrors.${error.code}`) {
      return localizedByCode;
    }
  }

  if (error?.message) {
    return error.message;
  }

  return t(fallbackPath);
}

export function getApiPayloadMessage(payload, t, fallbackMessage = "") {
  if (payload?.code) {
    const localizedByCode = t(`apiMessages.${payload.code}`);
    if (localizedByCode !== `apiMessages.${payload.code}`) {
      return localizedByCode;
    }
  }

  if (typeof payload?.message === "string" && payload.message) {
    return payload.message;
  }

  return fallbackMessage;
}
