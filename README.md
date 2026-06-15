# 🧭 Business Sarthi

**Cloud-based Employee Tracking & Business Management SaaS** — multi-tenant platform with three interfaces:

| Interface | Route | Roles |
|---|---|---|
| 🛡 Super Admin Panel | `/admin` | SUPER_ADMIN, ADMIN_EMPLOYEE (Admin/HR/Support/Finance) |
| 🏢 Company Panel | `/company` | COMPANY_OWNER, COMPANY_MANAGER |
| 📱 Staff App (mobile-first PWA) | `/staff` | STAFF |

## ✨ Features
- **Location tracking** — background pings every 30/60/120 min (package-driven), live map,
  route playback, heatmap, movement analysis, offline batch queue
- **Attendance** — GPS check-in/out, late detection, device info, monthly summaries
- **Leave management** — paid/unpaid/sick, balances, approval workflow
- **Sales tracker** — staff submissions, targets, staff/product/monthly analytics
- **Inventory & vendors** — stock movements, low-stock alerts, SKU per tenant
- **Payroll** — auto-generation from attendance (basic + allowance − deductions), slips by email
- **Packages** — max staff, tracking interval, 5 feature toggles; enforced by middleware
- **Real-time** — Socket.io rooms (platform / company / user): live maps, dashboards, notifications
- **Reports** — Excel (tracking, attendance, sales, payroll) + PDF (employee, company)
- **Email** — Nodemailer events: company/staff created, password reset, leave decisions, payroll, sales, package assigned
- **Security** — bcrypt, JWT + rotating refresh tokens with reuse detection, RBAC, tenant scoping,
  Joi validation, Helmet, CORS, rate limiting, mongo-sanitize, full audit log
- **UI** — React + Tailwind + shadcn-style components, blue/white theme, dark mode, responsive, Recharts, Google Maps

## 🚀 Quick Start (local)

```bash
# 1. Backend
cd backend
cp .env.example .env          # fill MONGO_URI, JWT secrets, EMAIL_* (optional)
npm install
npm run seed                  # super admin + demo company + packages
npm run dev                   # http://localhost:5000

# 2. Frontend
cd ../frontend
cp .env.example .env          # VITE_API_URL + VITE_GOOGLE_MAPS_API_KEY
npm install
npm run dev                   # http://localhost:5173
```

### Demo accounts (after seeding)
| Role | Email | Password |
|---|---|---|
| Super Admin | admin@businesssarthi.com | SuperAdmin@123 |
| Company Owner | owner@himalayatraders.com | Owner@1234 |
| Company Manager | manager@himalayatraders.com | Manager@1234 |
| Staff | hari@himalayatraders.com | Staff@1234 |

> Change all demo passwords before going to production.

### Docker
```bash
docker compose up -d --build   # web :8080, api :5000, mongo :27017
docker compose exec api node src/seed/seed.js
```

## 🧱 Stack
React 18 · Vite · Tailwind · Recharts · @react-google-maps/api · socket.io-client · Axios
Node 18+ · Express · Mongoose 8 · Socket.io · Joi · Nodemailer · ExcelJS · PDFKit · JWT
MongoDB Atlas · Vercel (web) · Render (api) · Docker

## 📚 Documentation
| Doc | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | system architecture, multi-tenancy, RBAC matrix, auth & tracking pipelines, folder structure |
| [docs/ER-DIAGRAM.md](docs/ER-DIAGRAM.md) | Mermaid ER diagram + index catalog |
| [docs/API.md](docs/API.md) | full REST + Socket.io reference |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Atlas / Render / Vercel / Docker guide + scalability roadmap |
| [docs/business-sarthi.postman_collection.json](docs/business-sarthi.postman_collection.json) | Postman collection (auto token capture) |

## 🔐 Security notes
- Credentials live **only** in `.env` (gitignored). `.env.example` has placeholders.
- Refresh tokens are stored **hashed**; reuse of a rotated token revokes all sessions.
- Every login, CRUD and export is written to the audit log (1-year TTL).
- If any real credential was ever shared (e.g. a Gmail app password), **revoke and rotate it now**.

## ✅ Verified
- Backend: 52/52 endpoint smoke tests pass (auth, RBAC denials, tracking, attendance,
  leaves, sales, inventory, payroll, Excel/PDF exports) against in-memory MongoDB.
- Frontend: production build passes (`vite build`).
