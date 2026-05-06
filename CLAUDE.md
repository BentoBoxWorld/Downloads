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
- Pages: Presets (`/`), Custom builder (`/custom`), Third-party catalog (`/thirdparty`), Blueprints (`/blueprints`), Submit (`/submit`), Account (`/account`), Terms (`/terms`), Privacy (`/privacy`)
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
- Images live at `weblink/blueprints/images/<gameMode>/<name>.png` (recommended 800×450, with optional `<name>.thumb.png` at 400×225). The catalog auto-detects them at sync time when the overlay does not specify `image`. The Express handler at `src/index.ts` serves them under `/blueprints/images/...` with a path-traversal guard and PNG-only whitelist.
- Endpoints: `GET /api/blueprints` (full catalog), `GET /api/blueprints/download?id=<gameMode>/<name>&type=blueprint|bundle` (single file), `GET /api/blueprints/zip?ids=[...]|gameMode=<gm>` (multi-select or whole-game-mode zip). IDs are validated against a strict regex and resolved paths are checked against the blueprints root before any read.

**Blog** (`src/api/blog.ts`, `src/api/models/blog.ts`, `src/web/components/blog/`, `src/web/components/admin/BlogTab.tsx`, `src/web/components/admin/BlogEditor.tsx`):
- Backed by `data/Blog.sqlite` via Sequelize. Models: `posts` (slug-keyed permalinks, draft/published, markdown source + sanitized HTML cache, view counter) and `post_revisions` (one row per save, pruned daily after 90 days).
- Markdown source is rendered server-side with `markdown-it` + `sanitize-html` on every save; the HTML is what's served to readers, so the public path doesn't ship a markdown engine. The admin editor preview uses `react-markdown` + `remark-gfm` + `remark-breaks` client-side.
- Permissions: an author is anyone with `users.isAdmin = true` OR `users.canAuthorBlog = true`. Pre-grant via `env.blog_author_discord_ids` (mirrors `admin_discord_ids`). `requireBlogAuthor` middleware in `auth.ts` gates writes; the Admin page filters its tab list to only "Blog" for users who are blog authors but not full admins.
- Endpoints: `GET /api/blog/posts?page&tag` (paginated public list, optional tag filter), `GET /api/blog/posts/:slug` (public, bumps view count), `GET /api/blog/tags` (aggregated tag counts across published posts), `GET /api/blog/feed.xml` (RSS 2.0), `GET /blog/sitemap.xml` (sitemap), `GET /blog/highlight.css` (highlight.js theme served from the bundled github-dark theme with our background override). Author endpoints under `/api/blog/admin/posts` (CRUD), `/api/blog/admin/posts/:id/publish` (with optional `{ at: <epoch_ms> }` body to schedule), `/api/blog/admin/posts/:id/unpublish`, `/api/blog/admin/images` for multipart uploads (5 MB cap, PNG/JPG/WebP/GIF only). All writes require `X-Csrf-Token` and `requireBlogAuthor`.
- Permalinks at `/blog/p/:slug` are server-rendered with OG/Twitter Card meta + JSON-LD Article schema + canonical URL by `BlogManager.renderPostPage()`. Express checks for the path in `src/index.ts` before falling through to the SPA. On `blog.bentobox.world`, the bare `/p/:slug` and `/feed.xml` paths also work via a hostname check (`isBlogHost`).
- On `draft → published` transition the manager fires a Discord webhook configured by `env.discord_blog_webhook_url` (full URL or `/api/webhooks/...` path). Failures are logged and ignored — they never block the publish.
- Subdomain plumbing: in production set `env.cookie_domain = ".bentobox.world"` so Discord sessions cover both `download.*` and `blog.*`. Recommended nginx config: a single `server` block for `blog.bentobox.world` that rewrites `/(.*)` to `/blog/$1` before proxying to the same upstream `:8080` — keeps the React Router and SSR paths uniform.
- Uploaded images live under `data/blog/images/YYYY/MM/<sha256-prefix>.<ext>` and are served by Express via the `/blog/images/...` static handler (path-traversal guarded, MIME whitelist).
- Markdown extras: code fences are server-side syntax-highlighted via `highlight.js` (auto-detect for unfenced langs); GitHub-style alert blockquotes (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`) are post-processed into `<div class="callout callout-X">` boxes with coloured labels.
- Scheduled posts have `status='scheduled'` and a future `publishedAt`. A per-minute cron promotes them to `published` and fires the Discord webhook at promotion time, not at scheduling time.
- Phase scope: Phase 1 = list + permalink + RSS + OG + Discord webhook + image uploads + draft/publish, single author. Phase 2 (current) adds tags + tag archive, code highlighting, GFM callouts, scheduled publishing, sitemap. Phase 3 will add multi-author grant UI, comments (Giscus), search, dev.to cross-post, git backup, analytics.

**Auth + submissions** (`src/api/auth.ts`, `src/api/submissions.ts`, `src/api/models/auth.ts`):
- Discord OAuth (server-side authorization-code flow, `identify` scope only). Sessions stored in `data/Auth.sqlite` via Sequelize (`User`, `Session`, `Submission` tables). Session cookie is HttpOnly, `SameSite=Lax`, `Secure` in production, and carries an opaque server-generated session id. 30-day TTL, max 5 concurrent sessions per user, daily prune cron.
- CSRF: per-session token returned by `GET /api/me`, required as `X-Csrf-Token` on every POST.
- Rate limits: 30 OAuth callbacks/min/IP; 3 submissions/hour, 10/day per Discord user.
- `POST /api/blueprints/submit` accepts a multipart upload (max 5 MB), JSON-parses, ajv-validates against `src/api/schemas/blueprint.schema.json` (vendored from `bentobox/`), runs `validateBlueprintSubmission` (rejects command-block materials and opaque `inventory` payloads), checks slug collision against the local clone, then opens a PR on `BentoBoxWorld/weblink` via Octokit using `env.weblink_github_token` — branch `submit/<discordId>/<slug>-<ts>` with two file commits (the `.blueprint` and the patched `catalog.json`).
- Helmet config in `src/index.ts` is the canonical CSP — Discord OAuth navigation works without an explicit allowlist because helmet's CSP does not constrain top-level navigation.
- `env.json` keys: `discord_client_id`, `discord_client_secret`, `discord_redirect_uri`, `weblink_github_token` (fine-grained PAT scoped to `BentoBoxWorld/weblink` with `contents: write` + `pull-requests: write`), and the blog-related keys `blog_author_discord_ids`, `discord_blog_webhook_url`, `blog_base_url`, `cookie_domain`.

## Key Patterns

- All addon metadata is configuration-driven via `config.json`; adding an addon means editing that file
- TypeScript types for config are in `src/config.d.ts`
- Build outputs to `dist/`; the server runs from `dist/` and reads config files from `../` (project root)
- Webpack bundles frontend to `dist/web/`; TypeScript compiles backend to `dist/`
- ESLint + Prettier enforced (config in `.eslintrc.js` and `.prettierrc.js`)

## CI

GitHub Actions (`.github/workflows/build.yml`) runs on push/PR to `develop`: tests Node.js 20.x/22.x with `yarn && yarn add sqlite3 && yarn build`.

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
