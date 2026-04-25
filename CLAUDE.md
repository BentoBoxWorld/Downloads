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
- Four pages: Presets (`/`), Custom builder (`/custom`), Third-party catalog (`/thirdparty`), Blueprints (`/blueprints`)
- Components in `src/web/components/`, API calls via `src/web/ApiRequestManager.ts` using SWR

**Configuration files** (project root, read at runtime from `../` relative to `dist/`):
- `config.json` — addon and preset definitions (the primary data source for all addons)
- `thirdparty.json` — third-party addon registry
- `env.json` (optional, from `env.example.json`) — GitHub token, Discord webhook, port settings, optional `weblink` block (url/path/branch) for the blueprint sync
- `Installation-Guide.txt` — bundled in generated ZIP files

**Blueprint catalog** (`src/api/weblink.ts`, `src/api/blueprintCatalog.ts`):
- `WeblinkSync` shallow-clones `BentoBoxWorld/weblink` into `data/weblink/` on startup and `git pull --ff-only`s it on the same 6-minute cron used for addon refresh. Default branch is `master`.
- `buildCatalog()` scans `weblink/blueprints/<gameMode>/`, parses `.blueprint` files and bundle `.json` files (per BentoBox's `blueprint.schema.json` / `blueprint-bundle.schema.json`), and derives stats: dimensions, block-type counts, entity-type counts, air count, biome list, sinking flag.
- The optional `blueprints/catalog.json` overlay in weblink supplies curation fields (`displayName`, `description`, `author`, `authorLink`, `tags`, `license`, `image`) plus tag colours and game-mode display names; overlay fields take precedence over what is in the `.blueprint` file.
- Endpoints: `GET /api/blueprints` (full catalog), `GET /api/blueprints/download?id=<gameMode>/<name>&type=blueprint|bundle` (single file), `GET /api/blueprints/zip?ids=[...]|gameMode=<gm>` (multi-select or whole-game-mode zip). IDs are validated against a strict regex and resolved paths are checked against the blueprints root before any read.
- Phase-2 submission sanitisers live next to the catalog code: `sanitizeBundleSubmission` strips `BlueprintBundle.commands` (console-command injection vector) and `validateBlueprintSubmission` rejects command-block materials and any block carrying an opaque `inventory` payload. They are not called by Phase-1 read-only flows; wire them in when the upload endpoint lands.

## Key Patterns

- All addon metadata is configuration-driven via `config.json`; adding an addon means editing that file
- TypeScript types for config are in `src/config.d.ts`
- Build outputs to `dist/`; the server runs from `dist/` and reads config files from `../` (project root)
- Webpack bundles frontend to `dist/web/`; TypeScript compiles backend to `dist/`
- ESLint + Prettier enforced (config in `.eslintrc.js` and `.prettierrc.js`)

## CI

GitHub Actions (`.github/workflows/build.yml`) runs on push/PR to `develop`: tests Node.js 12.x/14.x/16.x with `yarn && yarn add sqlite3 && yarn build`.

## Dependency Source Lookup

When you need to inspect source code for a dependency (e.g., BentoBox, addons):

1. **Check local Maven repo first**: `~/.m2/repository/` — sources jars are named `*-sources.jar`
2. **Check the workspace**: Look for sibling directories or Git submodules that may contain the dependency as a local project (e.g., `../bentoBox`, `../addon-*`)
3. **Check Maven local cache for already-extracted sources** before downloading anything
4. Only download a jar or fetch from the internet if the above steps yield nothing useful

Prefer reading `.java` source files directly from a local Git clone over decompiling or extracting a jar.

In general, the latest version of BentoBox should be targeted.

## Project Layout

Related projects are checked out as siblings under `~/git/`:

**Core:**
- `bentobox/` — core BentoBox framework

**Game modes:**
- `addon-acidisland/` — AcidIsland game mode
- `addon-bskyblock/` — BSkyBlock game mode
- `Boxed/` — Boxed game mode (expandable box area)
- `CaveBlock/` — CaveBlock game mode
- `OneBlock/` — AOneBlock game mode
- `SkyGrid/` — SkyGrid game mode
- `RaftMode/` — Raft survival game mode
- `StrangerRealms/` — StrangerRealms game mode
- `Brix/` — plot game mode
- `parkour/` — Parkour game mode
- `poseidon/` — Poseidon game mode
- `gg/` — gg game mode

**Addons:**
- `addon-level/` — island level calculation
- `addon-challenges/` — challenges system
- `addon-welcomewarpsigns/` — warp signs
- `addon-limits/` — block/entity limits
- `addon-invSwitcher/` / `invSwitcher/` — inventory switcher
- `addon-biomes/` / `Biomes/` — biomes management
- `Bank/` — island bank
- `Border/` — world border for islands
- `Chat/` — island chat
- `CheckMeOut/` — island submission/voting
- `ControlPanel/` — game mode control panel
- `Converter/` — ASkyBlock to BSkyBlock converter
- `DimensionalTrees/` — dimension-specific trees
- `discordwebhook/` — Discord integration
- `Downloads/` — BentoBox downloads site
- `DragonFights/` — per-island ender dragon fights
- `ExtraMobs/` — additional mob spawning rules
- `FarmersDance/` — twerking crop growth
- `GravityFlux/` — gravity addon
- `Greenhouses-addon/` — greenhouse biomes
- `IslandFly/` — island flight permission
- `IslandRankup/` — island rankup system
- `Likes/` — island likes/dislikes
- `Limits/` — block/entity limits
- `lost-sheep/` — lost sheep adventure
- `MagicCobblestoneGenerator/` — custom cobblestone generator
- `PortalStart/` — portal-based island start
- `pp/` — pp addon
- `Regionerator/` — region management
- `Residence/` — residence addon
- `TopBlock/` — top ten for OneBlock
- `TwerkingForTrees/` — twerking tree growth
- `Upgrades/` — island upgrades (Vault)
- `Visit/` — island visiting
- `weblink/` — data repo (blueprints, challenges, MCG configs, addon downloads matrix); the Downloads server clones a copy of this for the Blueprints tab
- `CrowdBound/` — CrowdBound addon

**Data packs:**
- `BoxedDataPack/` — advancement datapack for Boxed

**Documentation & tools:**
- `docs/` — main documentation site
- `docs-chinese/` — Chinese documentation
- `docs-french/` — French documentation
- `BentoBoxWorld.github.io/` — GitHub Pages site
- `website/` — website
- `translation-tool/` — translation tool

Check these for source before any network fetch.

## Key Dependencies (source locations)

- `world.bentobox:bentobox` → `~/git/bentobox/src/`
