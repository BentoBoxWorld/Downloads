#!/usr/bin/env node
/**
 * Deterministic safety net for config.json `versions` maps. Checks:
 *  1. JSON parses.
 *  2. No duplicate keys inside any `versions` block (raw-text scan — JSON.parse
 *     silently keeps the last occurrence, which has caused stale data before).
 *  3. Every MC version key is a real Minecraft release (per Mojang's manifest),
 *     apart from a small legacy allowlist.
 *  4. Key sets are consistent: any MC version >= 1.20.6 that appears in one
 *     addon's map should exist in BentoBox's map too (the site's dropdown is a
 *     union of keys; a key only one addon has makes every other addon appear
 *     unsupported for that version).
 *  5. If release data is supplied (--releases release-data.json), every mapped
 *     addon version must exist as a GitHub release tag for that repo (catches
 *     typos like 2.28.4 for 1.28.4).
 *
 * Usage: node validate-config.mjs [--releases release-data.json]
 * Exits non-zero if any check fails. Run from the project root.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const LEGACY_KEY_ALLOWLIST = new Set(['1.16-Java16']);
let failures = 0;
const fail = (msg) => {
    failures++;
    console.error('FAIL:', msg);
};

const raw = readFileSync('config.json', 'utf8');

// 1. parses
let config;
try {
    config = JSON.parse(raw);
} catch (e) {
    console.error('FAIL: config.json does not parse:', e.message);
    process.exit(1);
}

// 2. duplicate keys (raw text scan, per addon block)
const nameBlocks = raw.split(/"name": "/).slice(1);
for (const block of nameBlocks) {
    const name = block.split('"')[0];
    const m = block.match(/"versions": \{([^}]*)\}/);
    if (!m) continue;
    const keys = [...m[1].matchAll(/"([^"]+)"\s*:/g)].map((x) => x[1]);
    const seen = new Set();
    for (const k of keys) {
        if (seen.has(k)) fail(`${name}: duplicate key "${k}" in versions block (JSON.parse keeps the LAST one)`);
        seen.add(k);
    }
}

// 3. keys are real MC releases
const manifest = JSON.parse(
    execFileSync('curl', ['-s', 'https://launchermeta.mojang.com/mc/game/version_manifest.json'], {
        maxBuffer: 32 * 1024 * 1024,
    }).toString(),
);
const mcIds = new Set(manifest.versions.map((v) => v.id));
for (const addon of config.addons) {
    for (const key of Object.keys(addon.versions || {})) {
        if (!mcIds.has(key) && !LEGACY_KEY_ALLOWLIST.has(key)) {
            fail(`${addon.name}: "${key}" is not a real Minecraft version`);
        }
    }
}

// 4. key-set consistency for modern versions
const bentobox = config.addons.find((a) => a.name === 'BentoBox');
const modern = (k) => {
    const [maj, min] = k.split('.').map(Number);
    return maj >= 26 || (maj === 1 && min >= 21) || k === '1.20.6';
};
const bbKeys = new Set(Object.keys(bentobox?.versions || {}));
for (const addon of config.addons) {
    for (const key of Object.keys(addon.versions || {})) {
        if (modern(key) && !bbKeys.has(key)) {
            fail(`${addon.name}: has key "${key}" but BentoBox itself has no entry for it`);
        }
    }
}

// 5. mapped addon versions exist as release tags (optional)
const relArg = process.argv.indexOf('--releases');
if (relArg > -1) {
    const data = JSON.parse(readFileSync(process.argv[relArg + 1], 'utf8'));
    for (const addon of config.addons) {
        const repo = data.repos[addon.name];
        if (!repo || repo.error || !repo.releases) continue;
        const tags = new Set(repo.releases.map((r) => r.tag.replace(/^v/, '')));
        for (const [mc, ver] of Object.entries(addon.versions || {})) {
            // only check versions new enough to be inside the fetched release window
            const oldest = repo.releases[repo.releases.length - 1]?.tag.replace(/^v/, '');
            if (!tags.has(ver) && oldest && compareVersions(ver, oldest) > 0) {
                fail(`${addon.name}: ${mc} → "${ver}" but no such release tag on ${repo.github}`);
            }
        }
    }
}

function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d) return d;
    }
    return 0;
}

if (failures) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
}
console.log('config.json versions maps: all checks passed.');
