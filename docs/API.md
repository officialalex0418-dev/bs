# Business Sarthi — API Documentation (v1)

Base URL: `https://<api-host>/api/v1`
Auth: `Authorization: Bearer <accessToken>` (15 min) · refresh via httpOnly cookie or body.
All responses: `{ success, data | message, details? }`. Lists return `{ items, pagination: { total, page, limit, totalPages } }`.

Roles legend: **SA**=SUPER_ADMIN, **AE**=ADMIN_EMPLOYEE, **CO**=COMPANY_OWNER, **CM**=COMPANY_MANAGER, **ST**=STAFF.

## Auth
| Method | Path | Roles | Body / Notes |
|---|---|---|---|
| POST | `/auth/login` | public | `{ email, password }` → `{ user, accessToken, refreshToken }` (rate-limited) |
| POST | `/auth/refresh` | public | cookie or `{ refreshToken }` → rotated tokens |
| POST | `/auth/logout` | public | revokes refresh token |
| POST | `/auth/forgot-password` | public | `{ email }` — always 200 (no enumeration) |
| POST | `/auth/reset-password/:token` | public | `{ password }` — kills all sessions |
| GET | `/auth/verify-email/:token` | public | email verification |
| GET | `/auth/me` | any | current user |
| PATCH | `/auth/change-password` | any | `{ currentPassword, newPassword }` |

## Dashboards
| GET `/dashboard/super` | SA, AE | totals, revenue, packages, activities, tracking pings |
| GET `/dashboard/company` | CO, CM (+SA/AE w/ `?companyId=`) | staff counts, attendance, sales, 6-mo graph |
| GET `/dashboard/staff` | ST | check-in status, leave balance, late days, target progress |

## Companies (SA/AE)
| Method | Path | Notes |
|---|---|---|
| GET | `/companies?page&search&status` | list |
| POST | `/companies` | `{ name, email, address, panVat, phone, logo, packageId, ownerName, ownerEmail }` — creates owner + emails temp password |
| GET | `/companies/me` | CO/CM own company |
| GET | `/companies/:id` · PATCH `/companies/:id` | detail / update (incl. `status`, `settings`) |
| PATCH | `/companies/:id/package` | `{ packageId }` — emails + notifies owner |
| DELETE | `/companies/:id` | SA only — soft suspend + deactivate users |

## Packages
| GET `/packages?status=` | any authed | list |
| POST `/packages` | SA | `{ name, price, maxStaff, trackingIntervalMinutes: 30|60|120, features:{...5 toggles}, status }` |
| GET/PATCH/DELETE `/packages/:id` | SA (GET also AE) | delete blocked if in use |

## Staff / Employees
| GET `/staff?page&search&role&scope=system` | SA/AE/CO/CM | tenant-scoped; `scope=system` lists ADMIN_EMPLOYEEs |
| POST `/staff` | SA/AE/CO/CM | `{ name, email, phone, address, pan, position, basicSalary, dailyAllowance, monthlyTarget, role, subRole, companyId }` — enforces package `maxStaff`, emails temp password |
| GET/PATCH/DELETE `/staff/:id` | scoped | delete = soft deactivate |

## Location Tracking
| POST `/locations` | ST/CM | single ping `{ latitude, longitude, accuracy, batteryLevel, deviceInfo, recordedAt, source }` or batch `{ pings: [...] }` (max 200) → realtime broadcast |
| GET `/locations/config` | ST/CM | `{ enabled, intervalMinutes }` from package (feature-gated) |
| GET `/locations/live` | SA/AE/CO/CM | latest point per staff (24h window) |
| GET `/locations/history/:staffId?from&to` | SA/AE/CO/CM | route playback points (max 5000) |
| GET `/locations/heatmap?period=daily|weekly|monthly` | SA/AE/CO/CM | sampled points for heat layer |
| GET `/locations/analysis/:staffId?period=` | SA/AE/CO/CM | distance (haversine), ping count, first/last |

## Attendance
| POST `/attendance/check-in` | ST/CM | `{ latitude, longitude, deviceInfo }` — late detection vs company `workStartTime`+grace; 409 if repeated |
| POST `/attendance/check-out` | ST/CM | computes workedMinutes; <4h ⇒ HALF_DAY |
| GET `/attendance/me?month=YYYY-MM` | any | own records + late/present summary |
| GET `/attendance?date&month&staffId` | SA/AE/CO/CM | tenant list |

## Leaves
| POST `/leaves` | ST/CM | `{ type: PAID|UNPAID|SICK, fromDate, toDate, reason }` — balance-checked; notifies approvers |
| GET `/leaves/me` | any | own history + balance |
| GET `/leaves?status=` | SA/AE/CO/CM | tenant list |
| PATCH `/leaves/:id/decision` | SA/AE/CO/CM | `{ status: APPROVED|REJECTED, note }` — deducts balance, emails staff |

## Sales (feature: salesTracking)
| POST `/sales` | ST/CM | `{ productId?, productName, quantity, amount, customerName, remarks }` — decrements inventory if productId, low-stock alert, emails owner |
| GET `/sales?period=daily|weekly|monthly|3months|6months&staffId` | any (staff see own) | list |
| GET `/sales/analytics?period=` | SA/AE/CO/CM | byStaff, byProduct, monthly growth, totals |
| GET `/sales/me/summary` | ST | target vs achieved |

## Inventory (feature: inventoryManagement) — SA/AE/CO/CM
| GET `/inventory?search&category&lowStock=true` | list + `lowStockCount` |
| POST `/inventory` | `{ productName, sku, category, quantity, costPrice, sellingPrice, vendor, reorderLevel }` |
| PATCH `/inventory/:id` · DELETE (CO+) | update / soft delete |
| POST `/inventory/:id/stock` | `{ type: IN|OUT|ADJUST, quantity, note }` — movement history + low-stock notifications |

## Vendors (feature: vendorManagement) — SA/AE/CO/CM
CRUD at `/vendors`, `/vendors/:id` — `{ name, phone, email, address, panVat }`.

## Payroll
| POST `/payroll/generate` | SA/AE/CO/CM | `{ month: YYYY-MM, scope?: 'system' }` — per staff: basic + allowance×presentDays − absent deduction − 1% tax; skips existing; emails slips |
| GET `/payroll?month&scope=system` | any (staff see own) | list |
| PATCH `/payroll/:id/pay` | SA/AE/CO | mark PAID |

## Reports (binary downloads)
| GET `/reports/tracking/excel?period=` | xlsx |
| GET `/reports/attendance/excel?month=` | xlsx |
| GET `/reports/sales/excel?period=` | xlsx |
| GET `/reports/payroll/excel?month=` | xlsx |
| GET `/reports/employee/:staffId/pdf` | PDF — profile, attendance, sales, last payroll |
| GET `/reports/company/:companyId/pdf` | SA/AE — PDF company summary |

## Notifications / Settings / Audit
| GET `/notifications?unread=true` | any | inbox + `unreadCount` |
| PATCH `/notifications/read` | any | `{ ids?: [] }` (empty = all) |
| GET `/audit-logs?action&userId&companyId` | SA/AE | audit trail |
| GET `/settings` · PATCH `/settings` | scoped | smtp / branding / security per scope |
| PATCH `/profile/me` | any | `{ phone, profilePhoto }` |

## Socket.io Events
Connect: `io(url, { auth: { token: <accessToken> } })`

| Event (server → client) | Room | Payload |
|---|---|---|
| `location:update` | company + platform | `{ staffId, staffName, lat, lng, accuracy, recordedAt }` |
| `dashboard:update` | company + platform | `{ event, ... }` |
| `notification:new` | user | Notification document |
| `activity:new` | company + platform | `{ text, at }` |

## Error Format
```json
{ "success": false, "message": "Validation failed",
  "details": [{ "field": "email", "message": "\"email\" must be a valid email" }] }
```
HTTP codes: 400 validation · 401 auth · 403 role/feature/tenant · 404 · 409 conflict/duplicate · 429 rate limit · 500.
