import test from "node:test";
import assert from "node:assert/strict";
import { requireIntegrationToken } from "../middleware/integrationAuth.js";

const originalToken = process.env.DALI_POS_INTEGRATION_TOKEN;
const validToken = "f1b1b1df8d3b04c95d87037424c65c939ea94b6345aa4a39dc";

const invoke = (authorization) => {
  let statusCode;
  let body;
  let nextCalled = false;
  const headers = {};
  const res = {
    set: (name, value) => { headers[name] = value; },
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (value) => { body = value; },
  };
  const req = { get: () => authorization };

  requireIntegrationToken(req, res, () => { nextCalled = true; });
  return { statusCode, body, headers, nextCalled };
};

test.after(() => {
  if (originalToken === undefined) delete process.env.DALI_POS_INTEGRATION_TOKEN;
  else process.env.DALI_POS_INTEGRATION_TOKEN = originalToken;
});

test("integration API rejects requests when no strong token is configured", () => {
  delete process.env.DALI_POS_INTEGRATION_TOKEN;
  const result = invoke(`Bearer ${validToken}`);
  assert.equal(result.statusCode, 503);
  assert.equal(result.body.error.code, "INTEGRATION_NOT_CONFIGURED");
  assert.equal(result.nextCalled, false);
});

test("integration API requires the configured bearer token", () => {
  process.env.DALI_POS_INTEGRATION_TOKEN = validToken;
  const result = invoke("Bearer wrong-token");
  assert.equal(result.statusCode, 401);
  assert.equal(result.body.error.code, "UNAUTHORIZED");
  assert.equal(result.nextCalled, false);
});

test("integration API accepts a valid token without disabling cache protection", () => {
  process.env.DALI_POS_INTEGRATION_TOKEN = validToken;
  const result = invoke(`Bearer ${validToken}`);
  assert.equal(result.nextCalled, true);
  assert.equal(result.headers["Cache-Control"], "no-store");
});
