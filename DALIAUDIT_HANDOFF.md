# DALIAudit local connection handout

This handout describes the local DALIAudit ↔ DALI POS service connection. The POS API exposes selected data from its own MySQL database through HTTP; DALIAudit must not connect to MySQL directly. Each system keeps its own database and its own service token.

## Local setup

1. Start DALI POS on port `3000` and DALIAudit on LAN host `10.36.3.193:3003`. Port `3003` is occupied by a DALI POS instance only on the POS computer.
2. Copy `.env.example` to `.env` in each project. Do not copy one system's API token into the other system's inbound-token setting.
3. Generate two different random secrets (PowerShell):

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

4. In DALI POS `.env`, set:

   ```dotenv
   DALI_POS_INTEGRATION_TOKEN=<random token generated for DALIAudit-to-POS requests>
   DALIAUDIT_BASE_URL=http://10.36.3.193:3003
   DALIAUDIT_API_TOKEN=<DALIAudit-issued service token>
   ```

5. Configure DALIAudit to listen at `10.36.3.193:3003`, and set its outbound POS base URL to `http://<DALI_POS_LAN_IP>:3000` with the exact POS bearer token from `DALI_POS_INTEGRATION_TOKEN`. Configure DALIAudit's own inbound token to the separate value placed in DALI POS `DALIAUDIT_API_TOKEN`. Use `http://localhost:3000` only if both apps run on the same computer.
6. Restart both servers after changing environment variables. Tokens must be at least 32 bytes. Keep `.env` private; never place tokens in browser code, source control, URLs, logs, or prompts.

The supplied connection handout contains bearer-token values in plaintext. Treat them as exposed: rotate/replace them with fresh random values before using the connection, and store the replacements only in each app's ignored `.env` or deployment secret store. The checked-in `.env.example` intentionally leaves both tokens blank.

## DALIAudit calling DALI POS

Send a server-to-server request with:

```http
Authorization: Bearer <DALI_POS_INTEGRATION_TOKEN>
Accept: application/json
```

Implemented read-only endpoints:

| Endpoint | Data |
| --- | --- |
| `GET /api/integration/v1/health` | Authenticated API/database health and supported read capabilities |
| `GET /api/integration/v1/products?page=1&limit=50` | Active and inactive products, prices, cost prices, category, stock, and update time |
| `GET /api/integration/v1/inventory?page=1&limit=50` | Active products and current stock with pricing/category details |
| `GET /api/integration/v1/sales?page=1&limit=50&from=<ISO-8601>&to=<ISO-8601>` | Completed sales and line items within the optional inclusive date range |

Page numbers start at 1; `limit` defaults to 50 and cannot exceed 100. Responses use `{ "data": [...], "pagination": { "page", "limit", "total", "totalPages" } }` for list routes. Health returns `service`, `status`, and `capabilities`. Error responses use `{ "error": { "code", "message" } }`. A missing/weak server token returns 503; an absent or invalid bearer token returns 401. Sales do not include customer names, cashier identities, or voided transactions.

PowerShell smoke check:

```powershell
$token = "<DALI_POS_INTEGRATION_TOKEN>"
Invoke-RestMethod `
  -Uri "http://<DALI_POS_LAN_IP>:3000/api/integration/v1/health" `
  -Headers @{ Authorization = "Bearer $token"; Accept = "application/json" }
```

The POS token grants only these read endpoints. Product and sales data include `costPrice`/`unitCost`; treat responses as restricted business information. The API does not expose SQL, raw database access, user records, or write operations. Do not give the AI direct DB credentials or permit it to generate SQL against the POS database.

## DALI POS calling DALIAudit

The POS backend has an outbound helper at `services/daliAuditClient.js` for the published DALIAudit routes:

```js
import {
  getDaliAuditHealth,
  getDaliAuditStores,
  getDaliAuditInspections,
  getDaliAuditReport,
  referDaliAuditComplaint,
} from "./services/daliAuditClient.js";

const health = await getDaliAuditHealth();
const stores = await getDaliAuditStores();
const inspections = await getDaliAuditInspections({
  storeCode: "BR-001",
  status: "Noncompliant",
});
const report = await getDaliAuditReport("REP-2026-001");
```

For incident referral, call `referDaliAuditComplaint` with the documented `eventId`, `storeCode`, `complaintCategory`, `complaintReference`, `description`, and ISO 8601 `occurredAt` fields. The helper sends `DALIAUDIT_API_TOKEN` as a bearer token, accepts only `/api/...` paths on the configured DALIAudit origin, allows HTTP for loopback or non-production LAN testing, requires HTTPS in production, uses JSON, validates referral data, and times out after 10 seconds. HTTP on a LAN exposes the token to that network; use only on a trusted network. Its target URL and token are server-side only.

DALI POS also exposes these admin-session-protected proxy endpoints. They let an authenticated POS administrator use DALIAudit data without exposing the DALIAudit token to a browser:

| DALI POS endpoint | Method | DALIAudit operation |
| --- | --- | --- |
| `/api/integration/v1/daliaudit/health` | `GET` | Check DALIAudit readiness |
| `/api/integration/v1/daliaudit/stores` | `GET` | List store compliance status |
| `/api/integration/v1/daliaudit/inspections?storeCode=BR-001&status=Noncompliant` | `GET` | List/filter inspections |
| `/api/integration/v1/daliaudit/reports/REP-2026-001` | `GET` | Fetch a report |
| `/api/integration/v1/daliaudit/complaints/referral` | `POST` | Submit a validated complaint referral |

These proxy endpoints do not automatically submit complaints; a POS workflow must explicitly decide when a complaint merits a referral.

POS administrators can browse store and inspection data at `/admin/daliaudit`. The page loads both lists server-side and supports filtering inspections by store code or status.

The current POS does not have a configured branch code or a dedicated register-opening operation, so the DALIAudit store rating is not yet an automatic register/sales gate. Agree on the branch mapping and compliance policy before adding that behavior.

## Deployment after local testing

- Replace loopback URLs with each deployed service's HTTPS base URL.
- Use secret management at deployment; generate new, distinct production tokens and rotate/revoke local test tokens.
- Configure firewall/network policy so only the peer service can reach the integration API. Terminate TLS at a trusted HTTPS proxy or application server.
- Keep the API tokens server-to-server; browser clients and AI prompts must never receive them.
- Confirm DALIAudit's matching read scopes, endpoint paths, payloads, and token validation before enabling outbound calls.
- Local integer product/sale IDs are not globally stable. Agree on branch identifiers, cross-system product ID mapping, currency/time-zone conventions, retry/idempotency behavior, and ownership before implementing cross-system writes. Current integration is read-only.

This is a local-first API bridge, not direct database sharing. Online operation requires the deployed URLs, HTTPS, and the counterpart's separately configured API/token contract.
