# DALITrack integration handoff: Dali_pos

Reviewed: 2026-11-13  
Repository/version: Dali_pos v1.0.0  
Contact/team: unknown

## Current technology and startup

This repository is a standalone Node.js + Express + MySQL point-of-sale and inventory system built with the XianFire project structure. The app is not a DALITrack module with shared branch IDs or central authentication; it is a local application with its own database and role-based access. For local inter-module testing, connection targets are configured through environment variables instead of hardcoded URLs.

- Framework/runtime: Node.js ES modules, Express- Template engine: Handlebars rendered through `.xian` files
- Session/auth: `express-session`, `connect-flash`, local user records in MySQL
- Password hashing: bcrypt
- Persistence: MySQL via Sequelize and `mysql2`
- Default HTTP port: `3000` (configurable via `PORT`)
- Entry points:
  - `index.js`
  - `routes/index.js`
  - `models/db.js`
- Startup commands from `package.json`:
  - `npm start`
  - `npm run dev`
  - `npm run migrate`
  - `npm run seed:admin`
  - `npm run seed:products`
  - `npm run route:list`
  - `npm run route:cache`

Environment variables currently used by the project:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `PORT`
- `NODE_ENV`
- `SESSION_SECRET`

Local cross-module connection variables supported for the local DALITrack setup:

- `DALIRESOLVE_BASE_URL=http://127.0.0.1:3001`
- `DALICHECK_BASE_URL=http://127.0.0.1:3002`
- `DALIAUDIT_BASE_URL=http://10.36.3.193:3003`

The app loads values from a local `.env` file via `dotenv/config`, so each module can be configured for local testing without hardcoded service URLs. A sample file is provided at `.env.example` and should be copied to `.env` before running the app locally.

The app creates its default database automatically if it does not exist, then runs `sequelize.sync()` and some additive schema migrations in `models/db.js`. It now exposes selected POS data through a token-protected read-only API and includes an outbound DALIAudit HTTP client; a counterpart API contract and production deployment are not configured.

## Current features and roles

### User-facing features

This system provides:

- Login and logout flow
- Dashboard with sales and inventory summaries
- POS checkout and receipt generation
- Product catalog management
- Product stock updates and low-stock alerts
- Supplier directory and purchase orders with partial receiving
- User management for admin users
- Admin-only stock history and activity log views

Main routes:

- `GET /`
- `GET /login`
- `POST /login`
- `POST /logout`
- `GET /dashboard`
- `GET /pos`
- `POST /pos/checkout`
- `GET /sales`
- `GET /sales/:id/receipt`
- `GET /admin/products`
- `POST /admin/products`
- `POST /admin/products/:id/update`
- `POST /admin/products/:id/deactivate`
- `POST /admin/categories`
- `GET /admin/users`
- `POST /admin/users`
- `POST /admin/users/:id/update`
- `POST /admin/users/:id/toggle`
- `GET /admin/stock-history`
- `GET /admin/activity-logs`
- `GET /admin/purchase-orders`
- `POST /admin/suppliers`
- `POST /admin/suppliers/:id/update`
- `POST /admin/suppliers/:id/toggle`
- `POST /admin/purchase-orders`
- `POST /admin/purchase-orders/:id/receive`
- `POST /admin/purchase-orders/:id/cancel`

### Roles and access</n
Roles defined in the schema and code are:

- `admin`
- `staff`

Access rules implemented in `middleware/auth.js`:

- `requireAuth`: requires an authenticated session
- `requireRole(...roles)`: allows only specific roles
- Admin-only pages include product management, sales stock history, activity logs, and user management
- Staff users are authenticated but not permitted to access admin-only management screens
- Inactive users are rejected and logged out
- The last active admin cannot be demoted or disabled

There are no branch, department, inventory-location, or multi-site permission models in the app. This system does not implement separate branch-manager or management roles.

## Workflows

### 1. Authentication and session lifecycle

- A user signs in with `email` and `password`
- Password validation uses bcrypt comparison against the stored hash
- On successful login:
  - session is regenerated
  - session user object is stored
  - `ActivityLog` row is created with `action = "login"`
- On logout:
  - last login event is marked as offline and duration is computed
  - a logout event is stored
  - the session is destroyed

### 2. Product creation and stock tracking

- Admins can create products with:
  - name
  - barcode
  - price
  - costPrice
  - stock
  - categoryId
  - optional image file
- Barcode uniqueness is enforced.
- Product stock is a direct integer value on the product table.
- Low stock is treated as `stock <= 10`.
- Product deactivation marks the product inactive instead of deleting the record.
- Admins can manage suppliers and create purchase orders for active products.
- Purchase orders do not change stock until an admin records received quantities.
- Partial receipts are recorded separately; each receipt updates stock, stock history, and the product's current cost.

### 3. POS checkout workflow

Keyboard workflow: press F2 to focus product search, scan or type a barcode and press Enter to add an exact barcode match, press F4 to open payment, and press Escape to return to the order from payment.

The `checkout` controller handles a POST request with a JSON cart payload such as:

```json
{
  "items": [
    { "productId": 1, "quantity": 2 }
  ],
  "customerName": "Maria",
  "paymentMethod": "cash",
  "amountTendered": "500.00"
}
```

Processing logic:

- Validates cart is not empty and within size limits
- Validates product IDs and quantities
- Locks the affected product rows in a transaction
- Checks stock sufficiency
- Computes item subtotals and total amount
- Creates a `Transaction` record
- Creates `TransactionItem` rows
- Updates `Product.stock`
- Creates `StockHistory` entries with `movementType = "sale"`

Supported payment methods:

- `cash`
- `gcash`
- `maya`
- `card`

The transaction is wrapped in a Sequelize transaction and uses row locking for stock validation to reduce oversell races.

### 4. User administration workflow

- Admins can create users with either `admin` or `staff` role
- Password must be at least 12 characters
- Admins can update user names, role, or password
- The last active admin cannot be demoted or disabled
- Admin users cannot remove their own admin access from the user management form

### 5. Audit history and stock history

- `ActivityLog` stores login/logout records and session duration
- `StockHistory` records stock movement details, including:
  - `restock`
  - `sale`
  - `adjustment`
- Purchase receipts are recorded as `restock` movements with the purchase order and receipt IDs in the note.

### 6. Supplier purchase orders and receiving

- Admins can create and update supplier records, and deactivate suppliers without deleting their history.
- An admin creates an order with a supplier, active products, ordered quantities, and expected unit costs.
- Creating an order does not affect product stock.
- Admins can record partial or complete deliveries, specifying the quantity received and actual unit cost per product.
- Each receipt is saved with its receiving admin, timestamp, item quantities, unit costs, and optional note.
- Receipt creation, product stock changes, product cost updates, order status changes, and stock history entries are committed in one database transaction.
- The product's current cost is updated to the latest unit cost received.
- An order becomes `partially_received` or `received` based on received quantities. An open or partially received order can be cancelled; already received stock remains in inventory.
- Only admins can manage suppliers, create/cancel orders, or receive stock.

Returns, damage handling, and branch transfers are not implemented.

## Data ownership and schema

This app owns all data in its own MySQL database. There is no central DALITrack master catalog, branch registry, or identity system.

Key database entities from [database/schema.sql](database/schema.sql) and the model definitions:

| Entity | Important fields / relationships |
| --- | --- |
| User | `id`, `name`, unique `email`, `password`, `role`, `isActive` |
| Category | `id`, unique `name` |
| Product | `id`, `name`, `imageUrl`, unique `barcode`, `price`, `costPrice`, `stock`, `isActive`, `categoryId -> Category` |
| Transaction | `id`, `userId -> User`, `customerName`, `total`, `paymentMethod`, `amountTendered`, `changeGiven`, `status` |
| TransactionItem | `id`, `transactionId -> Transaction`, `productId -> Product`, `productName`, `unitPrice`, `unitCost`, `quantity`, `subtotal` |
| StockHistory | `id`, `productId -> Product`, `userId -> User`, `transactionId -> Transaction`, `movementType`, `quantityChange`, `stockBalance`, `note` |
| ActivityLog | `id`, `userId -> User`, `userName`, `role`, `action`, `sessionId`, `occurredAt`, `sessionDurationSeconds`, `status` |
| Supplier | `id`, `name`, `contactName`, `phone`, `email`, `address`, `isActive` |
| PurchaseOrder | `id`, `supplierId -> Supplier`, `createdBy -> User`, `status`, `totalCost`, `note` |
| PurchaseOrderItem | `id`, `purchaseOrderId -> PurchaseOrder`, `productId -> Product`, `productName`, `quantityOrdered`, `quantityReceived`, `unitCost` |
| PurchaseReceipt | `id`, `purchaseOrderId -> PurchaseOrder`, `receivedBy -> User`, `note`, `createdAt` |
| PurchaseReceiptItem | `id`, `purchaseReceiptId -> PurchaseReceipt`, `purchaseOrderItemId -> PurchaseOrderItem`, `productId -> Product`, `productName`, `quantity`, `unitCost` |

Important schema details:

- MySQL auto-increment integer primary keys are used for local records
- `Product.id` is local to this app only
- There are no shared branch IDs or central product IDs
- Product stock is stored on the `products` table, not a separate branch inventory table
- `ActivityLog` is local to the app only
- Supplier and purchase receipt history is local to this app
- There are no batch or expiration tables

The model associations are defined in [models/index.js](models/index.js):

- `User` has many `Transaction`
- `Category` has many `Product`
- `Product` belongs to `Category`
- `Transaction` has many `TransactionItem`
- `Product` has many `TransactionItem`
- `Product` has many `StockHistory`
- `User` has many `ActivityLog`
- `Supplier` has many `PurchaseOrder`
- `PurchaseOrder` has many `PurchaseOrderItem` and `PurchaseReceipt`
- `PurchaseReceipt` has many `PurchaseReceiptItem`

## Implemented API contract

This application is primarily a server-rendered web application rather than a JSON API-first service. Most writes are form submissions and HTML redirects, not independent stateless API endpoints.

### Authentication and session behavior

- Session cookie name: `connect.sid`
- Session secret: `SESSION_SECRET`; falls back to a generated secret if unset
- Cookie options:
  - `httpOnly: true`
  - `sameSite: "lax"`
  - `secure: process.env.NODE_ENV === "production"`
  - `maxAge: 8 * 60 * 60 * 1000`
- Auth requirement is enforced with `requireAuth` and `requireRole`

### Browser routes and request/response patterns

#### Login

- `GET /login`
  - renders login page
- `POST /login`
  - fields: `email`, `password`
  - success: redirect to `/dashboard`
  - failure: redirect to `/login` with flash error

#### Logout

- `POST /logout`
  - destroys session and redirects to `/login`

#### Dashboard

- `GET /dashboard`
  - requires authenticated session
  - returns rendered HTML summary page

#### POS checkout

- `POST /pos/checkout`
  - requires auth
  - accepts JSON body with `items`, `customerName`, `paymentMethod`, `amountTendered`
  - success returns JSON with `message`, `receipt`, `receiptUrl`
  - failure returns JSON like `{ "error": "..." }`

Example success response:

```json
{
  "message": "Sale completed successfully.",
  "receipt": {
    "id": 12,
    "customerName": "Maria",
    "total": "120.00",
    "paymentMethod": "cash",
    "amountTendered": "500.00",
    "changeGiven": "380.00",
    "items": [
      {
        "productId": 1,
        "productName": "Rice",
        "unitPrice": "60.00",
        "unitCost": "40.00",
        "quantity": 2,
        "subtotal": "120.00"
      }
    ]
  },
  "receiptUrl": "/sales/12/receipt"
}
```

Validation constraints in the checkout logic include:

- `items` must be an array and non-empty
- `productId` must be a safe integer >= 1
- `quantity` must be an integer >= 1
- `paymentMethod` must be one of the allowed values
- `amountTendered` must validate as currency if cash payment is used
- stock must be sufficient for every product in the cart

#### Product management

- `POST /admin/products`
  - fields include `name`, `barcode`, `price`, `costPrice`, `stock`, `categoryId`
  - optional file upload for product image
  - redirects to `/admin/products`

- `POST /admin/products/:id/update`
  - updates product details and optionally image

- `POST /admin/products/:id/deactivate`
  - disables the product from active sale listings

#### Supplier and purchase order management

- `POST /admin/suppliers`
  - creates a supplier record
- `POST /admin/suppliers/:id/update`
  - updates supplier contact details
- `POST /admin/suppliers/:id/toggle`
  - activates or deactivates the supplier
- `POST /admin/purchase-orders`
  - creates an order from active products, quantities, and expected unit costs
- `POST /admin/purchase-orders/:id/receive`
  - records one or more received quantities and actual unit costs; updates inventory atomically
- `POST /admin/purchase-orders/:id/cancel`
  - cancels an open or partially received order without reversing stock already received

#### User management

- `POST /admin/users`
  - creates a user with `name`, `email`, `password`, and `role`
- `POST /admin/users/:id/update`
  - updates user details
- `POST /admin/users/:id/toggle`
  - toggles active/inactive state

### Error handling

- `requireAuth` redirects unauthenticated users to `/login`
- `requireRole` renders an error page with HTTP 403 if role access is denied
- Validation errors are often returned as flash messages and redirect back to the relevant form page
- Product and sales validation may also throw custom errors with an HTTP status code and a JSON `error` message

### Duplicate protection and concurrency

Implemented protections include:

- Unique email in `users`
- Unique barcode in `products`
- Transaction locking during checkout for product stock validation
- Transaction locking during purchase-order receiving to prevent over-receiving and stock races
- Out-of-stock checks before finalizing a sale

Not implemented:

- idempotency keys for sales or product updates
- request retry-safe external event deduplication
- API versioning with stable response contracts
- cross-module deduplication or event ledger

## Data needed from other modules

This module does not currently consume data from other DALITrack modules. In a future integration design, the most likely required data would be:

- Stable product identifiers from a shared catalog
- Stable branch/location identifiers
- Sales and return events from the source of truth for transactions
- Approved stock adjustments or removals from other modules
- User identity or role data if a shared account system is introduced

Specific fields that may ultimately be needed:

- `productId` or mapped catalog ID
- `branchId` or mapping to local branch code
- `quantity`
- `reasonCode`
- `eventId`
- `occurredAt`

Current status: not implemented / unknown.

## Data this module can provide

This system can provide the following to other modules if a trusted integration API is later agreed:

- Product catalog data
  - product ID
  - name
  - barcode
  - category
  - price
  - active status
- Current stock levels
  - product stock count
- Sales data
  - transaction ID
  - product details
  - quantity sold
  - total revenue
  - timestamp
- Stock movement history
  - movement type
  - quantity change
  - stock balance after change
  - note
- User activity log data
  - login/logout activity
  - session duration

Selected product, inventory, and completed-sales data are now available through a token-protected, read-only integration API. Credentials are separate per direction; neither API exposes direct database access.

## Integration API

Implemented under `/api/integration/v1`, protected by `DALI_POS_INTEGRATION_TOKEN`:

- `GET /api/integration/v1/health`
- `GET /api/integration/v1/products`
- `GET /api/integration/v1/inventory`
- `GET /api/integration/v1/sales`

The DALIAudit outbound client is available in `services/daliAuditClient.js` and uses `DALIAUDIT_BASE_URL` and `DALIAUDIT_API_TOKEN`. It implements the documented DALIAudit health, stores, inspections, report, and complaint-referral calls. Admin-session-protected POS proxy routes are available under `/api/integration/v1/daliaudit/`.

Security model:

- separate bearer token per direction
- service credentials kept server-side; POS proxy routes require an active administrator session
- credentials kept server-side and excluded from source control
- HTTPS required for non-loopback outbound URLs

Important current gap:

- this module owns local integer IDs only and has no shared stable IDs across modules
- a central mapping layer would be required before cross-module updates are reliable

## Tests and limitations

### Existing checks in code

This repository contains defensive validation in controllers and SQL schema constraints, including:

- email uniqueness validation
- barcode uniqueness validation
- product stock sufficiency checks
- transaction locking during checkout
- admin protections for last active admin
- input range/type validation for prices, quantities, and customer names

### What is missing

- No unit/integration suite for checkout, user permissions, or database migrations
- No API contract or OpenAPI schema
- No live cross-module integration tests
- No EC2/proxy deployment setup
- No branch inventory model
- No batch/expiration tracking
- No cross-module write API, event deduplication, or automated synchronization

This project is a local POS/inventory application with read-only data APIs for DALIAudit and outbound DALIAudit lookup/referral calls. Production connectivity is not configured.

## Local and EC2 connectivity

### Local connectivity

Default local URL:

- `http://localhost:3000`

Database default assumptions:

- MySQL at `localhost:3306`
- database name: `Dali_pos`
- default MySQL user: `root`

For local DALITrack testing, the app now uses `.env` values for service URLs and ports, including entries such as:

- `PORT=3000`
- `DALIRESOLVE_BASE_URL=http://127.0.0.1:3001`
- `DALICHECK_BASE_URL=http://127.0.0.1:3002`
- `DALIAUDIT_BASE_URL=http://10.36.3.193:3003`

For the implemented POS ↔ DALIAudit bridge, configure `DALI_POS_INTEGRATION_TOKEN` and `DALIAUDIT_API_TOKEN` separately in `.env`; keep both secret values out of source control. See [DALIAUDIT_HANDOFF.md](./DALIAUDIT_HANDOFF.md) for setup, request examples, payload scope, and deployment requirements. Do not share database credentials: each service accesses its own database through its own API.

### EC2 and deployment status

- No reverse proxy configuration is implemented
- No HTTPS setup exists in the project
- No deployed integration environment or production secret management is configured

If this app were later deployed for DALITrack use:

- distinct app ports would be required
- each app would need its own cookie name if placed on localhost
- reverse proxy and HTTPS should be configured before production sessions are relied on
- backend-to-backend traffic should use dedicated module credentials rather than browser cookies

## Decisions needed from the other teams

The following decisions must be agreed before connecting this module to the wider DALITrack system:

- Who owns the central identity and shared user model?
- Who owns the product catalog and stable product identifiers?
- Which module owns branch definitions and branch-to-product mappings?
- Should all modules share one database or remain separate applications?
- What is the canonical ID mapping between this app and other modules?
- What is the source of truth for sales and returns?
- What will count as an inventory change event?
- Which module will own stock movement authorization rules?
- What authentication and credential model will be used between backend services?
- What API versioning, retry policy, and event deduplication rules will all modules use?
- What timestamp and currency standards apply to shared events?
- Which data is public read-only vs. restricted by module or role?

This project now provides a local-first, read-only DALIAudit integration API. It does not yet provide cross-module writes or a configured production deployment.
