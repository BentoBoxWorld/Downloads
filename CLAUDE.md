# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BentoBox Downloads is a full-stack TypeScript application that generates customized ZIP files containing BentoBox (a Minecraft server plugin) and its addons. It mirrors releases from GitHub and dev builds from Jenkins CI, caching JARs in SQLite databases. Users select addons via a React frontend, and the Express backend generates a ZIP on-the-fly.

## Build & Run Commands

```bash
yarn                    # Install dependencies
yarn build              # Production build (TypeScript compile + Webpack bundle)
yarn start              # Run the built server (serves on port 8080, runs from dist/)
yarn dev                # Full dev rebuild + start server
yarn site               # Frontend-only dev rebuild + start server
```

**Note:** The `clean` script uses Windows `rd` command. On macOS/Linux, manually `rm -rf dist` if needed.

**Setup:** Requires `npm i -g yarn`, then `yarn`, then optionally `yarn add sqlite3` if the native module fails to build.

## Architecture

**Backend** (`src/index.ts`, `src/api/`):
- Express server handles `/api/*` routes via `ApiManager` class and serves the React SPA for all other routes
- `ApiManager` (`src/api/api.ts`) is the core class: manages GitHub/Jenkins polling, JAR caching, download counting, and ZIP generation
- Scheduled cron job (every 6 minutes) updates addon releases from GitHub (via Octokit) and dev builds from Jenkins (ci.codemc.io)
- Three SQLite databases: `JarCache.sqlite` (cached JARs), `Downloads.sqlite` (download counts), and old version cache — all managed via Sequelize ORM (`src/api/models/database.ts`)

**Frontend** (`src/web/`):
- React 17 SPA with React Router, styled with Tailwind CSS + twin.macro/styled-components
- Three pages: Presets (`/`), Custom builder (`/custom`), Third-party catalog (`/thirdparty`)
- Components in `src/web/components/`, API calls via `src/web/ApiRequestManager.ts` using SWR

**Configuration files** (project root, read at runtime from `../` relative to `dist/`):
- `config.json` — addon and preset definitions (the primary data source for all addons)
- `thirdparty.json` — third-party addon registry
- `env.json` (optional, from `env.example.json`) — GitHub token, Discord webhook, port settings
- `Installation-Guide.txt` — bundled in generated ZIP files

## Key Patterns

- All addon metadata is configuration-driven via `config.json`; adding an addon means editing that file
- TypeScript types for config are in `src/config.d.ts`
- Build outputs to `dist/`; the server runs from `dist/` and reads config files from `../` (project root)
- Webpack bundles frontend to `dist/web/`; TypeScript compiles backend to `dist/`
- ESLint + Prettier enforced (config in `.eslintrc.js` and `.prettierrc.js`)

## CI

GitHub Actions (`.github/workflows/build.yml`) runs on push/PR to `develop`: tests Node.js 12.x/14.x/16.x with `yarn && yarn add sqlite3 && yarn build`.
