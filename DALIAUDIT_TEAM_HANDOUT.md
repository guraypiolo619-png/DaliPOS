# DALIAudit team handout: connect to DALI POS

This handout is for the DALIAudit developers configuring the local POS ↔ audit connection. Each app owns its own database. Do not connect to the other app's MySQL server; use the documented HTTP APIs and keep credentials server-side.

## 1. Local ports and addresses

| App | Listen port | URL from the POS computer |
| --- | ---: | --- |
| DALI POS | `3000` | `http://localhost:3000` |
| DALIAudit on the other LAN computer | `3003` | `http://10.36.3.193:3003` |

The original same-computer test port `3003` is already serving a DALI POS login page on the POS computer. The provided DALIAudit LAN computer is `10.36.3.193`, so use its port `3003` from the POS `.env`. If both apps are run on the same computer, DALIAudit needs a different free port such as `3004`. The POS API currently answers on IPv6 `localhost` at port `3000`; an unrelated Vite process owns IPv4 `127.0.0.1:3000`. Therefore, when both services run on this computer, DALIAudit must call POS using `http://localhost:3000`, not `http://127.0.0.1:3000`.

Configure DALIAudit's HTTP server on the LAN computer to listen on port `3003` and serve its API under `/api`. Its browser session cookie should remain `daliaudit.sid`; do not share browser cookies between apps or use a browser session for service authentication.

## 2. Configure separate service tokens

Use two independent high-entropy secrets (at least 32 bytes). Do not use the literal tokens from any handout; those values were included in plaintext and should be considered exposed. Rotate them and store replacements only in each app's ignored `.env` or its deployment secret manager.

Configure DALI POS `.env`:

```dotenv
PORT=3000
DALI_POS_INTEGRATION_TOKEN=<secret accepted by DALI POS for requests from DALIAudit>
DALIAUDIT_BASE_URL=http://10.36.3.193:3003
DALIAUDIT_API_TOKEN=<secret accepted by DALIAudit for requests from DALI POS>
```

Configure DALIAudit's server environment with the matching values according to its own configuration names, and ensure its listener is reachable at `10.36.3.193:3003`:

- The POS inbound token must equal `DALI_POS_INTEGRATION_TOKEN` in the POS `.env`.
- The DALIAudit inbound token must equal `DALIAUDIT_API_TOKEN` in the POS `.env`.
- Keep the tokens distinct; never put them in browser JavaScript, URLs, source files, logs, or AI prompts.

Restart both apps after setting the values. The POS inbound API returns `503 INTEGRATION_NOT_CONFIGURED` until its token is set, and `401 UNAUTHORIZED` for a missing or incorrect bearer token.

## 3. DALIAudit APIs that DALI POS calls

The POS server client in `services/daliAuditClient.js` sends `DALIAUDIT_API_TOKEN` as a bearer token. Implement or keep these DALIAudit routes:

| Method and route | Purpose |
| --- | --- |
| `GET /api/health` | Readiness check; return HTTP 200 and JSON with `service: "DALIAudit"`, `status: "ready"`, and `schemaVersion`. Return 503 if its database is unavailable. |
| `GET /api/stores` | Store codes and names, compliance status, rating, and last inspection time. |
| `GET /api/inspections?storeCode=BR-001&status=Noncompliant` | Inspection history; both query parameters are optional. |
| `GET /api/reports/:reportCode` | Compliance report details for a report code. |
| `POST /api/complaints/referral` | Accept a validated referral as JSON; return HTTP 201 with a receipt, status, event ID, and store code. |

Every route above must require:

```http
Authorization: Bearer <DALIAUDIT_API_TOKEN>
Accept: application/json
```

The referral request body is:

```json
{
  "eventId": "POS-INCIDENT-2026-001",
  "storeCode": "BR-001",
  "complaintCategory": "Hygiene",
  "complaintReference": "TX-99021-RETURN",
  "description": "Returned product reported with a possible temperature-control issue.",
  "occurredAt": "2026-11-23T17:30:00.000Z"
}
```

Use `eventId` as a stable deduplication key so retries do not create duplicate referrals. Do not assume POS automatically files complaints: a POS workflow must explicitly decide when to send one.

The POS calls these routes from its server, not from a browser. Its DALIAudit helper restricts calls to `/api/...`, sends JSON, uses a 10-second timeout, permits HTTP for local/LAN development, and requires HTTPS in production.

## 4. DALIAudit APIs to call on DALI POS

DALIAudit should call the POS using `http://localhost:3000` and this header:

```http
Authorization: Bearer <DALI_POS_INTEGRATION_TOKEN>
Accept: application/json
```

Read-only POS endpoints:

| Method and route | Data |
| --- | --- |
| `GET /api/integration/v1/health` | POS/database readiness and supported capabilities. |
| `GET /api/integration/v1/products?page=1&limit=50` | Active and inactive catalog items, price, cost, stock, category, and update time. |
| `GET /api/integration/v1/inventory?page=1&limit=50` | Active products and current stock. |
| `GET /api/integration/v1/sales?page=1&limit=50&from=<ISO-8601>&to=<ISO-8601>` | Completed sales and line items; date filters are optional and inclusive. |

List routes return `data` and `pagination` (`page`, `limit`, `total`, `totalPages`). `limit` defaults to 50 and is capped at 100. Sales omit customer names, cashier identities, and voided transactions. Product/sales responses include cost information and must be treated as restricted business data. Do not query the POS database directly or expose its database credentials.

For example, from PowerShell on the same computer:

```powershell
$token = "<DALI_POS_INTEGRATION_TOKEN>"
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/integration/v1/health" `
  -Headers @{ Authorization = "Bearer $token"; Accept = "application/json" }
```

## 5. Verify the DALIAudit server

From the POS machine, verify that DALIAudit is listening and that its token is accepted:

```powershell
$token = "<DALIAUDIT_API_TOKEN>"
Invoke-RestMethod `
  -Uri "http://10.36.3.193:3003/api/health" `
  -Headers @{ Authorization = "Bearer $token"; Accept = "application/json" }
```

Expected ready response includes `service: "DALIAudit"` and `status: "ready"`. A connection refusal means no service is listening on port `3003` or the network/firewall blocks it; a 401 means the token is absent or mismatched; a 503 means DALIAudit is running but not ready.

## 6. LAN and deployment

- For two computers on a trusted LAN, replace loopback addresses with the other computer's reachable LAN address and allow the chosen ports through its firewall. Make sure the POS server is bound to an interface reachable by DALIAudit; `localhost` only works on the same computer.
- HTTP on a LAN exposes bearer credentials to that network. Use it only for temporary trusted local testing.
- For deployment, use HTTPS URLs, new production secrets, network restrictions, and a secret manager. Rotate all local test tokens.
- Agree on stable branch/product identifiers and whether compliance should gate POS operations before implementing any automatic behavior. POS currently has no branch mapping or automatic register gate.
