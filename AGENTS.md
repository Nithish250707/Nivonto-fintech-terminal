<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Repo facts that matter

- Single-package app at repo root (not a monorepo): Next.js App Router + TypeScript.
- Toolchain versions are pinned in `package.json`: `next@16.2.2`, `react@19.2.4`, `react-dom@19.2.4`.
- Use `npm` commands by default (`package-lock.json` is present).

## Real entrypoints

- `app/layout.tsx` is the root layout and font-variable wiring.
- `app/page.tsx` is the current root route (`/`).
- `app/globals.css` sets Tailwind v4 via `@import "tailwindcss"` and defines theme tokens.

## Verified commands

- `npm run dev` — start local dev server.
- `npm run build` — production build (best full-project validation available here).
- `npm run start` — run the production build.
- `npm run lint` — run ESLint using `eslint.config.mjs`.

## Validation and workflow gotchas

- There is no `test` script and no repo CI workflow configured under `.github/workflows/`.
- There is no dedicated `typecheck` script; if needed, run `npx tsc --noEmit`.
- Path alias `@/*` maps to repo root (`tsconfig.json`).
# AI Trading Terminal

## What this is
A dark-themed AI-powered trading terminal. Think Bloomberg Terminal meets ChatGPT.
Target users: Indian retail traders (NSE/BSE) and US stock traders.

## Stack
- Next.js 14 App Router + TypeScript
- Tailwind CSS + shadcn/ui
- TradingView Lightweight Charts (free widget)
- OpenAI API for AI chat
- Massive.com API for market data

## Phase 1 Goal
Build the terminal UI shell:
- 3-panel layout: left watchlist, center chart, right AI chat
- Dark theme (#0a0a0a background, green/amber accents)
- Ticker search bar at top
- No real data yet — static/mock data is fine

## Design Reference
Similar to heyastral.ai/terminal — data-dense, dark, professional