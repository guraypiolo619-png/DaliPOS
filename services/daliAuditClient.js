const TOKEN_MIN_BYTES = 32;
const REQUEST_TIMEOUT_MS = 10_000;
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

const integrationError = (message, statusCode = 503) =>
  Object.assign(new Error(`DALIAudit integration: ${message}`), { statusCode });

const configuredBaseUrl = () => {
  const value = process.env.DALIAUDIT_BASE_URL;
  const token = process.env.DALIAUDIT_API_TOKEN;
  if (!value) throw integrationError("DALIAUDIT_BASE_URL is not configured.");
  if (!token || Buffer.byteLength(token) < TOKEN_MIN_BYTES) {
    throw integrationError("DALIAUDIT_API_TOKEN must contain at least 32 bytes.");
  }

  let baseUrl;
  try {
    baseUrl = new URL(value);
  } catch {
    throw integrationError("DALIAUDIT_BASE_URL must be an absolute URL.");
  }

  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  const isHttpAllowed =
    baseUrl.protocol === "http:" &&
    (localHosts.has(baseUrl.hostname) || process.env.NODE_ENV !== "production");
  if (baseUrl.protocol !== "https:" && !isHttpAllowed) {
    throw integrationError("HTTPS is required outside non-production local/LAN development.");
  }
  if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw integrationError("DALIAUDIT_BASE_URL must not contain credentials, query parameters, or a fragment.");
  }

  baseUrl.pathname = `${baseUrl.pathname.replace(/\/+$/, "")}/`;
  return { baseUrl, token };
};

export const requestDaliAudit = async (path, { method = "GET", body, headers = {} } = {}) => {
  if (typeof path !== "string" || !path.startsWith("/api/") || path.startsWith("//")) {
    throw integrationError("request paths must be relative API paths beginning with /api/.");
  }
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(path.split(/[?#]/, 1)[0]);
  } catch {
    throw integrationError("request path contains invalid encoding.");
  }
  if (decodedPath.includes("\\") || decodedPath.split("/").includes("..")) {
    throw integrationError("request path must not contain traversal segments.");
  }

  if (typeof method !== "string") {
    throw integrationError("HTTP method must be a string.");
  }
  const normalizedMethod = method.toUpperCase();
  if (!ALLOWED_METHODS.has(normalizedMethod)) {
    throw integrationError(`HTTP method ${normalizedMethod} is not allowed.`);
  }

  const { baseUrl, token } = configuredBaseUrl();
  const target = new URL(path.slice(1), baseUrl);
  const apiBasePath = new URL("api/", baseUrl).pathname;
  if (target.origin !== baseUrl.origin || !target.pathname.startsWith(apiBasePath)) {
    throw integrationError("request path must remain within the configured DALIAudit base URL.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const requestHeaders = new Headers(headers);
    requestHeaders.set("Accept", "application/json");
    requestHeaders.set("Authorization", `Bearer ${token}`);
    if (body !== undefined) requestHeaders.set("Content-Type", "application/json");

    let response;
    try {
      response = await fetch(target, {
        method: normalizedMethod,
        headers: requestHeaders,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error.name === "AbortError") {
        throw integrationError("request timed out.", 504);
      }
      throw integrationError("could not reach the configured service.", 502);
    }

    if (!response.ok) {
      throw integrationError(`remote API returned HTTP ${response.status}.`, 502);
    }
    if (response.status === 204) return null;

    try {
      return await response.json();
    } catch {
      throw integrationError("remote API returned an invalid JSON response.", 502);
    }
  } finally {
    clearTimeout(timeout);
  }
};

export const getDaliAuditHealth = () => requestDaliAudit("/api/health");

export const getDaliAuditStores = () => requestDaliAudit("/api/stores");

export const getDaliAuditInspections = ({ storeCode, status } = {}) => {
  const query = new URLSearchParams();
  if (storeCode !== undefined) {
    if (typeof storeCode !== "string" || !/^[A-Za-z0-9_-]{1,32}$/.test(storeCode)) {
      throw new Error("storeCode must contain 1-32 letters, numbers, underscores, or hyphens.");
    }
    query.set("storeCode", storeCode);
  }
  if (status !== undefined) {
    if (typeof status !== "string" || !status.trim() || status.length > 64) {
      throw new Error("status must be a non-empty string of at most 64 characters.");
    }
    query.set("status", status.trim());
  }

  const serializedQuery = query.toString();
  const suffix = serializedQuery ? `?${serializedQuery}` : "";
  return requestDaliAudit(`/api/inspections${suffix}`);
};

export const getDaliAuditReport = (reportCode) => {
  if (typeof reportCode !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(reportCode)) {
    throw new Error("reportCode must contain 1-80 letters, numbers, underscores, or hyphens.");
  }
  return requestDaliAudit(`/api/reports/${encodeURIComponent(reportCode)}`);
};

export const referDaliAuditComplaint = (referral) => {
  const fields = {
    eventId: 128,
    storeCode: 32,
    complaintCategory: 64,
    complaintReference: 128,
    description: 2000,
  };
  if (!referral || typeof referral !== "object" || Array.isArray(referral)) {
    throw new Error("A referral object is required.");
  }

  const payload = {};
  for (const [field, maxLength] of Object.entries(fields)) {
    const value = referral[field];
    if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
      throw new Error(`${field} must be a non-empty string of at most ${maxLength} characters.`);
    }
    payload[field] = value.trim();
  }
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(payload.storeCode)) {
    throw new Error("storeCode must contain 1-32 letters, numbers, underscores, or hyphens.");
  }

  const occurredAt = referral.occurredAt;
  if (
    typeof occurredAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T/.test(occurredAt) ||
    !/(?:Z|[+-]\d{2}:\d{2})$/i.test(occurredAt) ||
    Number.isNaN(Date.parse(occurredAt))
  ) {
    throw new Error("occurredAt must be a valid ISO 8601 timestamp with a time zone.");
  }
  payload.occurredAt = occurredAt;

  return requestDaliAudit("/api/complaints/referral", {
    method: "POST",
    body: payload,
  });
};
