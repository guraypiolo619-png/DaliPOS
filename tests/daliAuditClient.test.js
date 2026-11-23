import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  getDaliAuditHealth,
  getDaliAuditInspections,
  getDaliAuditReport,
  getDaliAuditStores,
  referDaliAuditComplaint,
  requestDaliAudit,
} from "../services/daliAuditClient.js";

const originalBaseUrl = process.env.DALIAUDIT_BASE_URL;
const originalToken = process.env.DALIAUDIT_API_TOKEN;
const originalNodeEnv = process.env.NODE_ENV;
const token = "e9c4a042a2e5389932a0a56b8a0d745f2e7fbcd5a40ed0";

const restore = (name, value) => {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
};

test.after(() => {
  restore("DALIAUDIT_BASE_URL", originalBaseUrl);
  restore("DALIAUDIT_API_TOKEN", originalToken);
  restore("NODE_ENV", originalNodeEnv);
});

test("outbound client sends the DALIAudit bearer token and JSON body", async (t) => {
  let requestData;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requestData = {
      method: req.method,
      url: req.url,
      authorization: req.headers.authorization,
      body: JSON.parse(Buffer.concat(chunks).toString()),
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ accepted: true }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  process.env.DALIAUDIT_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.DALIAUDIT_API_TOKEN = token;
  const result = await requestDaliAudit("/api/insights", {
    method: "POST",
    body: { eventId: "local-test" },
    headers: { authorization: "Bearer caller-value" },
  });

  assert.deepEqual(result, { accepted: true });
  assert.deepEqual(requestData, {
    method: "POST",
    url: "/api/insights",
    authorization: `Bearer ${token}`,
    body: { eventId: "local-test" },
  });
});

test("outbound client refuses paths outside the API prefix", async () => {
  process.env.DALIAUDIT_BASE_URL = "http://127.0.0.1:3003";
  process.env.DALIAUDIT_API_TOKEN = token;
  await assert.rejects(
    requestDaliAudit("/admin/secrets"),
    /request paths must be relative API paths/,
  );
  await assert.rejects(
    requestDaliAudit("/api/..%2fadmin"),
    /must not contain traversal segments/,
  );
});

test("DALIAudit API helpers follow the documented routes and referral contract", async (t) => {
  const requests = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requests.push({
      method: req.method,
      url: req.url,
      authorization: req.headers.authorization,
      body: chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined,
    });
    res.writeHead(req.method === "POST" ? 201 : 200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, data: [] }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  process.env.DALIAUDIT_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.DALIAUDIT_API_TOKEN = token;

  await getDaliAuditHealth();
  await getDaliAuditStores();
  await getDaliAuditInspections({ storeCode: "BR-001", status: "Noncompliant" });
  await getDaliAuditReport("REP-2026-001");
  await referDaliAuditComplaint({
    eventId: "POS-INCIDENT-2026-001",
    storeCode: "BR-001",
    complaintCategory: "Hygiene",
    complaintReference: "TX-99021-RETURN",
    description: "Returned item reported at the branch.",
    occurredAt: "2026-11-23T17:30:00.000Z",
  });

  assert.deepEqual(requests.map(({ method, url }) => [method, url]), [
    ["GET", "/api/health"],
    ["GET", "/api/stores"],
    ["GET", "/api/inspections?storeCode=BR-001&status=Noncompliant"],
    ["GET", "/api/reports/REP-2026-001"],
    ["POST", "/api/complaints/referral"],
  ]);
  assert.ok(requests.every((request) => request.authorization === `Bearer ${token}`));
  assert.deepEqual(requests[4].body, {
    eventId: "POS-INCIDENT-2026-001",
    storeCode: "BR-001",
    complaintCategory: "Hygiene",
    complaintReference: "TX-99021-RETURN",
    description: "Returned item reported at the branch.",
    occurredAt: "2026-11-23T17:30:00.000Z",
  });
});

test("DALIAudit helpers validate report codes and referral payloads before sending", async () => {
  assert.throws(() => getDaliAuditReport("../other"), /reportCode must contain/);
  assert.throws(() => referDaliAuditComplaint({
    eventId: "event",
    storeCode: "BR-001",
    complaintCategory: "Hygiene",
    complaintReference: "ref",
    description: "text",
    occurredAt: "not-a-date",
  }), /occurredAt must be a valid ISO 8601 timestamp/);
});

test("outbound client allows configured LAN HTTP only outside production", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  process.env.DALIAUDIT_BASE_URL = "http://192.0.2.10:3003";
  process.env.DALIAUDIT_API_TOKEN = token;
  process.env.NODE_ENV = "development";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ status: "ready" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await getDaliAuditHealth();
    assert.equal(requestedUrl, "http://192.0.2.10:3003/api/health");
    process.env.NODE_ENV = "production";
    await assert.rejects(getDaliAuditHealth(), /HTTPS is required/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
