# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

VesselRFQ is a B2B marketplace for ASME pressure vessel RFQs. It connects pressure vessel buyers (refineries, plants, EPCs, project engineers) with qualified ASME Code fabricators. The core value proposition is compressing the traditional RFQ process by routing each RFQ to a maximum of 3 qualified fabricators per region.

**Terminology rules — non-negotiable in all code, copy, and UI:**
- "marketplace" not "network"
- "RFQs" not "leads"
- "protected territories" not "geographically spread out"
- Maximum 3 bidders per RFQ — never more

## Current State

Single static HTML landing page (`index.html`). No framework, no build system, no dependencies. Deployed on Vercel — push to `main` deploys automatically.

GitHub: github.com/mundster53/vesselrfq
Deploy: `git add . && git commit -m "message" && git push origin main`

## Planned Stack (for vessel designer feature)

- **Frontend:** React + Vite + TypeScript
- **Styling:** Tailwind CSS
- **Backend:** Vercel serverless functions (API routes in `/api`)
- **Database:** Supabase (PostgreSQL)
- **ORM:** Drizzle ORM
- **Auth:** Custom JWT — no third-party auth libraries
- **Hosting:** Vercel (existing account)

## Database

Supabase PostgreSQL. Connection via `DATABASE_URL` environment variable in `.env.local` (use the session pooler connection string from the Supabase dashboard).
Use Drizzle ORM for all schema and queries. Run `npm run db:push` to sync schema.

## Vessel Designer Feature — Scope

The vessel designer allows buyers to configure a pressure vessel and submit it as an RFQ. Fabricators receive the RFQ and submit quotes.

### Vessel configuration must support:
- Shell: diameter, length, material (SA-516-70, SA-240-304, SA-240-316, etc.)
- Head types: 2:1 Elliptical, Hemispherical, ASME F&D, Torispherical, Flat
- Design conditions: MAWP, temperature, corrosion allowance
- Nozzle schedule: size, rating (150# to 2500#), flange type, facing, material, service, quantity, location (shell, left head, right head)
- Supports: saddles (with height and width inputs), legs, skirts, lugs
- Heat exchangers: tube count, OD, BWG, length, material, pitch, TEMA type, channel/head type, baffle type and spacing

### RFQ workflow:
1. Buyer registers and designs vessel
2. Submits as RFQ
3. System routes to max 3 qualified fabricators in buyer's region
4. Fabricators receive RFQ, submit quotes
5. Buyer compares quotes and awards job

## User Roles

- **Buyer** — designs vessels, submits RFQs, compares quotes, awards jobs
- **Fabricator** — views open RFQs in their territory, submits quotes
- (Future) **Supplier** — receives material RFQs from fabricators

## TypeScript

Fix all TypeScript errors immediately. Never defer or suppress them with `any` unless absolutely necessary and commented.

## File Deliverables

Word documents (.docx) not Markdown for any document outputs intended for Bret.

## Owner Context

Bret Mundt — ~36 years in code fabrication and industrial construction, including ~5 years as estimator at an ASME fab shop and ~19 years running an industrial construction company. Not a former fab shop owner. This distinction matters in all copy.
