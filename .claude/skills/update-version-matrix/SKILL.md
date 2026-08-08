---
name: update-version-matrix
description: >
  Update the MC-version → addon-version maps in config.json from GitHub release
  data. Use whenever the user says "update the version matrix", "update
  config.json versions", "sync addon versions", "a new Minecraft version is
  out", "update supported versions", or any variant. Fetches every addon's
  recent GitHub releases, reads the Compatibility section of each release to
  find each one's MINIMUM Minecraft version, and regenerates each addon's
  `versions` map so the newest release owns every Minecraft version from its
  minimum up to the latest — addons are forward-compatible and are not
  re-released just because a new Minecraft version shipped.
---

# Update the config.json version matrix

`config.json` maps each addon to a `versions` object: `{ "<mc version>": "<addon version>" }`,
meaning "on this Minecraft/Paper version, download this addon version". The Custom
page's version dropdown is the union of all keys, and an addon is only enabled for a
dropdown entry when it has that **exact** key — so key strings must be identical across
addons. The `latest`/`beta` behaviour is separate; these maps only serve *older-version*
downloads plus the "which addons work on MC X" display.

## Hard-won pitfalls (all have actually happened)

1. **Duplicate keys are silent data corruption.** `JSON.parse` keeps the *last*
   occurrence, so prepending a new `"26.1.1": "2.0.0"` while the old `"26.1.1": "1.9.0"`
   still sits lower in the block means the site serves 1.9.0. Never prepend without
   removing the old entry; always run the validator.
2. **Only use MC version ids that Mojang actually shipped** (the manifest is the truth).
   `26.2.1` was once invented by accident; the real id was `26.2`. Release notes saying
   "26.1.x" must be expanded to the real ids (`26.1`, `26.1.1`, `26.1.2`), not written
   as a literal key.
3. **Addon version typos** (e.g. `2.28.4` when the release is `1.28.4`) — every value
   must be an actual release tag of that repo. The validator checks this.
4. **Compatibility claims are free text and vary**: "Paper Minecraft 1.21.11 - 26.2",
   "Minecraft 1.21.5 – 1.21.11, 26.1.x", "Minecraft 1.21.x", en-dash or hyphen, with or
   without "Paper". Some releases omit the section entirely — fall back to the nearest
   older release that states one, or leave the existing mapping alone and flag it.
5. **Draft releases are invisible to the public API** and cannot be downloaded by the
   site (`getReleaseByTag` won't find them). A version that `gh release view` shows but
   `fetch-releases.mjs` doesn't is almost certainly a draft (`isDraft: true`) — map to
   the newest *published* release instead (Challenges `1.8.0` was once mapped while
   still an unpublished draft).
6. **Claims can lag reality** (a release says "1.21.x" but is known to run on 26.x).
   This is normal and expected — see the forward-compatibility rule below. An addon is
   *not* re-released just because a new Minecraft version shipped and it still works, so
   a stale-looking upper bound is the default state, not a problem to flag.
7. **Never treat a compatibility claim as an upper bound.** Reading "Minecraft 1.21.5 –
   26.1.2" as "does not run on 26.2" is wrong and was the cause of 19 of 33 addons
   showing "—" on the newest Minecraft. The range's *lower* bound is the real constraint.

## The forward-compatibility rule (most important thing in this file)

**A compatibility claim states a MINIMUM, not a range.** BentoBox addons keep working on
newer Minecraft versions; they are only re-released when something actually breaks or a
feature is added. So:

> For each addon, take its newest published non-prerelease release **R** and the oldest
> Minecraft version **L** that R supports. Every tracked MC version **≥ L** maps to R —
> all the way up to `latestMc`, regardless of where R's stated range stops.

Older releases fill in only *below* L. Consequences:

- Every addon should end up with a key for `latestMc` unless it has a genuine hard floor
  above it. After a run, check coverage: `latestMc` at less than 100% of addons is a bug
  in your reasoning, not a finding about the addons.
- A newer release with a *narrower* stated claim than its predecessor (Challenges 1.8.0
  says "1.21.x" where 1.7.0 said "including 26.2") does **not** mean support was dropped.
  The newest release still wins on every MC version at or above its minimum.
- The only reason to withhold the newest release from a high MC version is an explicit
  hard requirement it cannot meet — e.g. DeathChest 1.0.0 requires Java 25 and Paper
  26.x, so it has a real floor at 26.1.2 and must not be mapped down to 1.21.x.

Deriving **L**: use the lower bound of R's stated range ("1.21.5 – 26.2" → `1.21.5`;
"1.21.5 or later" → `1.21.5`; "1.21.10+" → `1.21.10`). When R only says something vague
like "1.21.x", use the oldest tracked key already mapped to R in the current config, or
the explicit lower bound from the most recent release that gave one — do not silently
drop the floor to the bottom of the 1.21 line.

## Procedure

1. **Fetch data** (from the project root):

   ```bash
   node .claude/skills/update-version-matrix/scripts/fetch-releases.mjs > /tmp/release-data.json
   ```

   This emits: the real MC release list (`mcReleases`, newest first, plus `latestMc`),
   and for every addon in config.json with a `github` repo, its recent releases with
   `tag`, `publishedAt`, and the extracted `compatibility` text (null if none stated).

2. **Decide the tracked MC window.** Manage keys for MC versions from `1.20.6` upward
   (everything below is legacy — never touch those entries, including `1.16-Java16`).
   The tracked set = every id in `mcReleases` from `1.20.6` up to `latestMc` that the
   site already tracks, plus any newer ids not yet in config.json. Skip ids the site
   has never tracked and that no addon claims (e.g. `1.21.2` if it was never listed).
   When Mojang ships a new version, also update the hardcoded badges in
   `src/web/components/Landing.tsx` (the "Compatible with" chip list and the
   "MC 1.15–X.x" stat cell).

3. **Find each addon's minimum.** For each release (skip prereleases and drafts), read
   the lower bound out of its `compatibility` text — that is the only part that binds.
   Expand `.x` shorthand against `mcReleases` when you need real ids ("26.1.x" → `26.1`,
   `26.1.1`, `26.1.2`). A release with no compatibility section states no minimum of its
   own; inherit the nearest older release that does.

4. **Rebuild each `versions` map** by applying the forward-compatibility rule above:
   the newest release owns every tracked MC version from its minimum up to `latestMc`,
   and progressively older releases fill the keys below it. Keep all existing legacy
   entries (< 1.20.6) untouched and in place. Order keys newest-first. Preserve the
   file's existing formatting: 2-space JSON indent, keys in the same style. Do NOT
   reformat unrelated parts of config.json. `JSON.stringify(cfg, null, 2) + '\n'`
   round-trips the file byte-identically and matches `renderConfigJson` in
   `src/api/admin.ts`, so rebuilding the whole file that way is safe.

5. **Validate** (mandatory, catches pitfalls 1–3):

   ```bash
   node .claude/skills/update-version-matrix/scripts/validate-config.mjs --releases /tmp/release-data.json
   ```

6. **Check `latestMc` coverage.** Every addon should have a key for `latestMc`. List any
   that do not and justify each one by a genuine hard floor (Java/Paper/BentoBox API
   requirement), not by a stale compatibility string. If you cannot justify it, the
   mapping is wrong.

7. **Summarise for the user** before committing:
   - a table of what changed (addon, MC version, old → new addon version),
   - anything flagged: repos with fetch errors, releases with no stated compatibility,
     addons held back from `latestMc` and why, keys left alone out of caution.
   - Do not commit unless the user asked for that in this session.
