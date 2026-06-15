# Business Sarthi — System Architecture

## 1. High-Level Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │                 CLIENTS                       │
                    │  ┌────────────┐ ┌────────────┐ ┌───────────┐ │
                    │  │ Super Admin│ │  Company   │ │ Staff App │ │
                    │  │   Panel    │ │   Panel    │ │ (PWA /    │ │
                    │  │  (React)   │ │  (React)   │ │  Native)  │ │
                    │  └─────┬──────┘ └─────┬──────┘ └─────┬─────┘ │
                    └────────┼──────────────┼──────────────┼───────┘
                             │  HTTPS (REST + JWT)  │  WSS (Socket.io)
                    ┌────────▼──────────────▼──────────────▼───────┐
                    │              VERCEL (Frontend CDN)            │
                    └──────────────────────┬───────────────────────┘
                                           │
                    ┌──────────────────────▼───────────────────────┐
                    │           RENDER (Node.js / Express)          │
                    │  ┌─────────────────────────────────────────┐  │
                    │  │  Middleware Pipeline                     │  │
                    │  │  helmet → cors → sanitize → rate-limit   │  │
                    │  │  → JWT auth → RBAC → feature-gate        │  │
                    │  │  → validation (Joi) → controller         │  │
                    │  └─────────────────────────────────────────┘  │
                    │  ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
                    │  │ REST API │ │Socket.io │ │ Report Engine│   │
                    │  │ (v1)     │ │ rooms    │ │ (xlsx / pdf) │   │
                    │  └──────────┘ └──────────┘ └──────────────┘   │
                    │  ┌──────────┐ ┌──────────────────────────┐    │
                    │  │ Email    │ │ Audit / Notification svc │    │
                    │  │(Nodemailer)└──────────────────────────┘    │
                    └──────┬──────────────────────────┬─────────────┘
                           │                          │
              ┌────────────▼────────────┐   ┌─────────▼──────────┐
              │   MongoDB Atlas (M10+)  │   │  Google Maps APIs  │
              │  replica set, 2dsphere  │   │  (JS SDK, browser) │
              │  TTL + compound indexes │   └────────────────────┘
              └─────────────────────────┘
```

## 2. Multi-Tenancy Model

**Shared database, shared collection, tenant-scoped rows** — every tenant document
carries a `company` ObjectId. Enforcement layers:

1. `scopeCompany` middleware forces `req.companyId` = caller's own company for
   non-platform roles (cannot be overridden from query params).
2. Every controller query includes `company: req.companyId`.
3. Platform roles (SUPER_ADMIN / ADMIN_EMPLOYEE) may pass `?companyId=` explicitly.
4. Compound indexes lead with `company` for index locality per tenant.

## 3. RBAC Matrix

| Capability                  | SUPER_ADMIN | ADMIN_EMPLOYEE | COMPANY_OWNER | COMPANY_MANAGER | STAFF |
|----------------------------|:---:|:---:|:---:|:---:|:---:|
| Manage companies           | ✅ | ✅ | — | — | — |
| Manage packages            | ✅ | read | — | — | — |
| Manage system employees    | ✅ | ✅ | — | — | — |
| Manage company staff       | ✅ | ✅ | ✅ | ✅ | — |
| View live tracking / routes| ✅ | ✅ | ✅ | ✅ | — |
| Push location pings        | — | — | — | ✅ | ✅ |
| Check-in / out, leaves     | — | — | — | ✅ | ✅ |
| Approve leaves             | ✅ | ✅ | ✅ | ✅ | — |
| Submit sales               | — | — | — | ✅ | ✅ |
| Inventory / vendors        | ✅ | ✅ | ✅ | ✅ | — |
| Generate payroll           | ✅ | ✅ | ✅ | ✅ | — |
| Platform settings / audit  | ✅ | ✅ | — | — | — |

Feature gates (`requireFeature`) additionally check the company's package toggles:
`employeeTracking`, `inventoryManagement`, `vendorManagement`, `payrollManagement`, `salesTracking`.

## 4. Authentication Flow

```
Login ─► verify bcrypt hash ─► issue:
        • access token  (JWT, 15 min, in memory/localStorage)
        • refresh token (JWT, 7 days, httpOnly cookie + hashed copy in DB)

API call ─► Bearer access token ─► protect middleware
401 expired ─► POST /auth/refresh ─► rotate refresh token (old hash deleted,
               reuse of a revoked token nukes ALL sessions = theft detection)
Logout ─► delete stored hash + clear cookie
```

All login/logout/refresh/reset events are written to `auditlogs`.

## 5. Location Tracking Pipeline

```
Staff device (every 30/60/120 min per package)
  │  POST /locations  { latitude, longitude, accuracy, batteryLevel, deviceInfo }
  │  (offline → queued locally, flushed as { pings: [...] } batch)
  ▼
API: insertMany → LocationLog (GeoJSON Point, 2dsphere index)
  │
  ├─► Socket.io emit 'location:update' → room company:<id> + room platform
  │     (live map markers move without refresh)
  └─► TTL index purges raw pings after 180 days
```

Interval is **server-driven**: the device calls `GET /locations/config`, which reads
the company's package (`trackingIntervalMinutes`) — changing the package instantly
changes device behaviour on next config fetch.

## 6. Socket.io Room Topology

| Room              | Members                          | Events received |
|-------------------|----------------------------------|-----------------|
| `platform`        | super admin, admin employees     | all dashboards, all locations, all activity |
| `company:<id>`    | owner + managers of that company | location:update, dashboard:update, activity:new |
| `user:<id>`       | each user                        | notification:new |

Handshake is authenticated with the same JWT access token (`socket.handshake.auth.token`).

## 7. Folder Structure

```
business-sarthi/
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── server.js            # http + socket bootstrap, graceful shutdown
│       ├── app.js               # express app: security, parsing, routes, errors
│       ├── config/  env.js  db.js
│       ├── constants/ roles.js
│       ├── models/              # 13 Mongoose schemas + index.js barrel
│       ├── middleware/          # auth, rbac, validate, error, rateLimit
│       ├── controllers/         # auth, company, package, staff, location,
│       │                        # attendance, leave, sale, inventory, vendor,
│       │                        # payroll, dashboard, report, misc
│       ├── routes/              # index.js (all routes) + validators.js (Joi)
│       ├── services/            # token, email, notification, report
│       ├── sockets/ index.js    # io init + room emit helpers
│       ├── utils/               # ApiError, pagination, audit, dates
│       └── seed/ seed.js
├── frontend/
│   ├── Dockerfile  nginx.conf  vite.config.js  tailwind.config.js
│   └── src/
│       ├── main.jsx  App.jsx  index.css
│       ├── api/client.js        # axios + auto-refresh + downloads
│       ├── context/             # Auth, Socket, Theme providers
│       ├── components/ui/       # shadcn-style primitives
│       ├── components/          # LiveMap, StaffManager, PayrollManager, SettingsForm
│       ├── hooks/useLocationTracker.js   # background tracking logic
│       ├── layouts/DashboardLayout.jsx   # sidebar shell + notifications
│       └── pages/ auth/ superadmin/ company/ staff/
├── docs/        # architecture, ER diagram, API docs, deployment, postman
└── docker-compose.yml
```
