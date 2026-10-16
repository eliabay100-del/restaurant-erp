# Restaurant ERP — Warka Dine

A bilingual (English / አማርኛ) restaurant & café management system: point of sale, kitchen display, inventory, staff, shifts, and reporting. Built as a modern web app so it runs on a till, tablet, or back-office PC.

> Product name in the UI is **Mesob** (መሶብ). The codebase package name is `warka-dine`.

---

## Features

**Point of Sale**
- Touch-friendly PIN login with role-based routing (Admin, Manager, Cashier, Waiter, Kitchen)
- Cashier, Waiter, and Kitchen Display (KDS) screens
- Menu browsing by category, with variants/portions and product images
- Cart, order type (dine-in / takeaway / delivery), order status lifecycle
- Payment capture (cash, card, mobile money), change calculation, and receipts

**Back office**
- Dashboard overview with KPIs
- Order history and live order tracking
- Menu management (categories, items, variants, recipes)
- Inventory items and stock transactions
- Staff/employee records and salary payments
- Shift management: open/close, cash reconciliation, approval workflow
- Reports with CSV/PDF export

**Platform**
- Realtime updates over Socket.io (new orders appear instantly on the kitchen screen)
- Full internationalisation with `next-intl` — every string in English and Amharic
- Amharic typography via Noto Sans Ethiopic
- Installable PWA with an offline app shell and an online/offline banner
- Food Analytica-inspired visual theme

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| UI | React 19 + hand-rolled CSS design system (`src/app/globals.css`) |
| State | Zustand + React context |
| i18n | `next-intl` (locale-prefixed routing, `en` default) |
| Database | SQLite via Prisma ORM |
| Realtime | Socket.io |
| Auth | PIN-based staff auth with hashed PINs (`bcryptjs`) |

---

## Getting started

### Prerequisites
- Node.js 20+
- npm

### Install

```bash
npm install
```

### Configure

Create a `.env` file in the project root:

```env
DATABASE_URL="file:./dev.db"
```

### Set up the database

```bash
npm run db:push     # create the SQLite schema
npm run db:seed     # load demo menu, staff, and inventory
```

### Run

```bash
npm run dev         # custom Node server (Next + Socket.io), development
npm start           # production server (build first)
npm run build       # production build
```

Then open <http://localhost:3000>.

> `npm run dev` / `npm start` run `server.js`, which hosts Next.js **and** the Socket.io realtime server on the same port. Use `npm run dev:next` for the plain Next.js dev server (no realtime).

Use a custom port with either:

```bash
npm start -- --port 3002
```

---

## Demo staff PINs

Seeded by `npm run db:seed`:

| Name | Role | PIN |
|---|---|---|
| Admin | ADMIN | `1234` |
| Abebe | MANAGER | `5678` |
| Tigist | CASHIER | `1111` |
| Dawit | CASHIER | `3333` |
| Kebede | KITCHEN | `2222` |
| Meron | KITCHEN | `4444` |

> Change these before any real deployment.

---

## Project layout

```
server.js                 Next.js + Socket.io host (dev/prod entry point)
prisma/
  schema.prisma           Data model (Staff, Shift, Category, MenuItem, Variant,
                          RecipeIngredient, Order, OrderItem, Payment, SalaryPayment,
                          InventoryItem, InventoryTransaction, AuditLog)
  seed.ts                 Demo data
messages/
  en.json, am.json        UI strings (English / Amharic)
src/
  app/[locale]/           Routes: (auth) login · (pos) cashier/waiter/kitchen ·
                          (dashboard) overview/orders/menu/inventory/employees/shifts/reports
  components/             Shared UI (Icon, SiteFooter, offline banner, reports, POS)
  context/                Auth + Socket providers
  features/               Domain logic (auth, orders, payments, menu, ...)
  hooks/                  Reusable hooks
  i18n/                   next-intl routing/config
  lib/                    Helpers, role/permission rules
  middleware.ts           Locale routing + auth guard
public/
  logo.png, manifest.webmanifest, sw.js   PWA assets
```

---

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server with realtime (`server.js`) |
| `npm run dev:next` | Plain Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Production server with realtime |
| `npm run lint` | ESLint |
| `npm run db:push` | Apply the Prisma schema to SQLite |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Reset the database and re-seed |

---

## Notes

- The SQLite database (`prisma/dev.db`), the `.env` file, uploaded menu images, and build output are intentionally **not** committed.
- Rebuilds change Next.js server-action IDs — reload open browser tabs after a build.

---

## Powered by

Built by [Amba Solutions](https://amba.site.je).
