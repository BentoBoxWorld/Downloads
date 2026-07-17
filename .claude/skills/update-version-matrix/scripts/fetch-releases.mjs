#!/usr/bin/env node
/**
 * Gathers everything needed to regenerate the `versions` maps in config.json:
 *  - the real Minecraft release list from Mojang's version manifest
 *  - recent GitHub releases (tag, date, Compatibility section) for every addon
 *    in config.json that has a `github` repo
 *
 * Usage: node fetch-releases.mjs [--per-page 12] > release-data.json
 * Requires: `gh` CLI authenticated, network access. Run from the project root.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const perPageArg = process.argv.indexOf('--per-page');
const perPage = perPageArg > -1 ? Number(process.argv[perPageArg + 1]) : 12;

const config = JSON.parse(readFileSync('config.json', 'utf8'));

// Real MC versions, newest first (release type only)
const manifest = JSON.parse(
    execFileSync('curl', ['-s', 'https://launchermeta.mojang.com/mc/game/version_manifest.json'], {
        maxBuffer: 32 * 1024 * 1024,
    }).toString(),
);
const mcReleases = manifest.versions.filter((v) => v.type === 'release').map((v) => v.id);

function compatibilitySection(body) {
    if (!body) return null;
    const m = body.match(/#+\s*Compatibility\s*([\s\S]*?)(?=\n#+\s|$)/i);
    if (m) return m[1].trim();
    // fall back to any line mentioning Minecraft/MC versions
    const lines = body.split('\n').filter((l) => /minecraft|paper|spigot|\bMC\b/i.test(l) && /\d+\.\d+/.test(l));
    return lines.length ? lines.join('\n') : null;
}

const out = { fetchedAt: new Date().toISOString(), latestMc: manifest.latest.release, mcReleases, repos: {} };

for (const addon of config.addons) {
    if (!addon.github) continue;
    process.stderr.write(`fetching ${addon.github}...\n`);
    let releases;
    try {
        releases = JSON.parse(
            execFileSync('gh', ['api', `repos/${addon.github}/releases?per_page=${perPage}`], {
                maxBuffer: 32 * 1024 * 1024,
            }).toString(),
        );
    } catch (e) {
        out.repos[addon.name] = { github: addon.github, error: String(e.message || e).slice(0, 200) };
        continue;
    }
    out.repos[addon.name] = {
        github: addon.github,
        releases: releases
            .filter((r) => !r.draft)
            .map((r) => ({
                tag: r.tag_name,
                prerelease: r.prerelease,
                publishedAt: r.published_at,
                compatibility: compatibilitySection(r.body),
            })),
    };
}

console.log(JSON.stringify(out, null, 2));
