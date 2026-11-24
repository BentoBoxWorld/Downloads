import axios from 'axios';
import * as fs from 'node:fs';
import { Octokit } from 'octokit';
import { AddonsEntity } from '../config';

/**
 * All-time download totals per addon from each distribution platform.
 * Every fetcher returns { <config addon name>: <cumulative downloads> } and
 * only includes addons it could positively match, so a project that isn't
 * on a platform simply contributes nothing.
 *
 * Matching:
 *   GitHub      the addon's own `github` repo — exact.
 *   Modrinth    project `link_urls.source` → GitHub repo — exact.
 *   CurseForge  project `links.sourceUrl` → GitHub repo — exact. Candidate
 *               project IDs come from the public Bukkit ServerMods search,
 *               because the Core API's own search is not open to our key.
 *   Hangar      projects carry no source links, so by normalised name with
 *               the store's naming affixes stripped (SkyBlock-BSkyBlock,
 *               Warps-for-BentoBox, BentoBoxParkour).
 */

export type DownloadCounts = Record<string, number>;

const USER_AGENT = 'BentoBoxWorld-Downloads/1.0 (+https://download.bentobox.world)';
const MODRINTH_ORG = 'bentobox';
const HANGAR_OWNER = 'BentoBoxWorld';
const SERVERMODS_SEARCH = 'https://servermods.forgesvc.net/servermods/projects';
/** Last discovered CurseForge project IDs, reused if the ServerMods search goes away. */
const CURSEFORGE_ID_CACHE = './../data/CurseforgeProjects.json';

/** "https://github.com/BentoBoxWorld/Level/" → "bentoboxworld/level" (or null if not a GitHub repo URL). */
export function repoKey(url: unknown): string | null {
    if (typeof url !== 'string') return null;
    const m = /github\.com\/([^/\s]+)\/([^/\s#?]+)/i.exec(url);
    return m ? `${m[1]}/${m[2].replace(/\.git$/i, '')}`.toLowerCase() : null;
}

function byRepo(addons: AddonsEntity[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const a of addons) out[a.github.toLowerCase()] = a.name;
    return out;
}

function norm(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Hangar slug → candidate addon keys, stripping store-listing affixes. */
export function hangarCandidates(slug: string): string[] {
    const n = norm(slug);
    const out = [n];
    const stripped = n
        .replace(/forbentobox$/, '')
        .replace(/^bentobox(?=.)/, '')
        .replace(/^skyblock(?=.)/, '');
    if (stripped !== n) out.push(stripped);
    return out;
}

export async function fetchGithub(octokit: Octokit, addons: AddonsEntity[]): Promise<DownloadCounts> {
    const out: DownloadCounts = {};
    for (const a of addons) {
        const [owner, repo] = a.github.split('/');
        try {
            const releases = await octokit.paginate(octokit.rest.repos.listReleases, { owner, repo, per_page: 100 });
            let total = 0;
            for (const r of releases) for (const asset of r.assets) total += asset.download_count;
            out[a.name] = total;
        } catch (e) {
            console.error(`[stats] github releases for ${a.github} failed:`, (e as Error)?.message ?? e);
        }
    }
    return out;
}

export async function fetchModrinth(addons: AddonsEntity[]): Promise<DownloadCounts> {
    const res = await axios.get(`https://api.modrinth.com/v3/organization/${MODRINTH_ORG}/projects`, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 30000,
    });
    if (!Array.isArray(res.data)) throw new Error('unexpected Modrinth response');
    const repos = byRepo(addons);
    const out: DownloadCounts = {};
    for (const p of res.data as { downloads?: unknown; link_urls?: { source?: { url?: unknown } } }[]) {
        const name = repos[repoKey(p?.link_urls?.source?.url) ?? ''];
        const n = Number(p?.downloads);
        if (name && Number.isFinite(n)) out[name] = (out[name] ?? 0) + n;
    }
    return out;
}

export async function fetchHangar(addons: AddonsEntity[]): Promise<DownloadCounts> {
    const res = await axios.get('https://hangar.papermc.io/api/v1/projects', {
        params: { owner: HANGAR_OWNER, limit: 100 },
        headers: { 'User-Agent': USER_AGENT },
        timeout: 30000,
    });
    const projects = res.data?.result;
    if (!Array.isArray(projects)) throw new Error('unexpected Hangar response');
    const names: Record<string, string> = {};
    for (const a of addons) names[norm(a.name)] = a.name;
    const out: DownloadCounts = {};
    for (const p of projects as { name?: unknown; stats?: { downloads?: unknown } }[]) {
        if (typeof p?.name !== 'string') continue;
        const match = hangarCandidates(p.name)
            .map((c) => names[c])
            .filter(Boolean)[0];
        const n = Number(p?.stats?.downloads);
        if (match && Number.isFinite(n)) out[match] = (out[match] ?? 0) + n;
    }
    return out;
}

/**
 * Needs a CurseForge Core API key (console.curseforge.com, "$2a$10$…") — the
 * author upload token is a different credential and is rejected with 403.
 *
 * Our key may fetch mods by ID but not use /v1/mods/search, so discovery is:
 *   1. search Bukkit's public ServerMods API for "bentobox" and each addon
 *      name, collecting every candidate project ID (~1,200, mostly unrelated);
 *   2. fetch them from the Core API in batches and keep the ones whose
 *      source URL is one of our repos.
 * The matched IDs are saved, so if ServerMods is ever retired we keep
 * counting the projects we already know about.
 */
export async function fetchCurseforge(apiKey: string, addons: AddonsEntity[]): Promise<DownloadCounts> {
    const ids = await discoverCurseforgeIds(addons);
    const repos = byRepo(addons);
    const out: DownloadCounts = {};
    const matched: number[] = [];
    // Sequential batches: keeps us well inside CurseForge's rate limits.
    for (let i = 0; i < ids.length; i += 100) {
        const mods = await fetchCurseforgeMods(apiKey, ids.slice(i, i + 100));
        for (const m of mods) {
            const name = repos[repoKey(m?.links?.sourceUrl) ?? ''];
            const n = Number(m?.downloadCount);
            if (name && Number.isFinite(n) && typeof m.id === 'number') {
                out[name] = (out[name] ?? 0) + n;
                matched.push(m.id);
            }
        }
    }
    saveCurseforgeIds(matched);
    return out;
}

/** Candidate project IDs: saved matches plus every ServerMods search hit for our names. */
async function discoverCurseforgeIds(addons: AddonsEntity[]): Promise<number[]> {
    const known = loadCurseforgeIds();
    const ids: Record<string, boolean> = {};
    for (const id of known) ids[id] = true;

    const terms = ['bentobox'];
    for (const a of addons) {
        for (const t of [a.name.toLowerCase(), a.name.toLowerCase().replace(/\s+/g, '')]) {
            if (!terms.includes(t)) terms.push(t);
        }
    }
    let searched = 0;
    // Sequential on purpose: ~40 small requests to a legacy public endpoint.
    for (const term of terms) {
        const hits = await searchServerMods(term);
        if (hits === null) continue;
        for (const id of hits) ids[id] = true;
        searched++;
    }
    if (searched === 0)
        console.warn(`[stats] ServerMods search unavailable; using ${known.length} saved CurseForge IDs`);
    return Object.keys(ids).map(Number);
}

/** Project IDs matching one search term, or null if the search failed. */
async function searchServerMods(term: string): Promise<number[] | null> {
    try {
        const res = await axios.get(SERVERMODS_SEARCH, {
            params: { search: term },
            headers: { 'User-Agent': USER_AGENT },
            timeout: 30000,
        });
        if (!Array.isArray(res.data)) return null;
        return (res.data as { id?: unknown }[]).map((p) => p?.id).filter((id): id is number => typeof id === 'number');
    } catch {
        return null; // one failed term just narrows discovery
    }
}

type CurseforgeMod = { id?: unknown; downloadCount?: unknown; links?: { sourceUrl?: unknown } };

async function fetchCurseforgeMods(apiKey: string, modIds: number[]): Promise<CurseforgeMod[]> {
    const res = await axios
        .post(
            'https://api.curseforge.com/v1/mods',
            { modIds },
            { headers: { 'x-api-key': apiKey, Accept: 'application/json' }, timeout: 30000 },
        )
        .catch((e) => {
            if (e?.response?.status === 403) {
                throw new Error(
                    'key rejected (403) — curseforge_api_key must be a Core API key from ' +
                        'console.curseforge.com, not the author upload token',
                );
            }
            throw e;
        });
    const mods = res.data?.data;
    if (!Array.isArray(mods)) throw new Error('unexpected CurseForge response');
    return mods as CurseforgeMod[];
}

function loadCurseforgeIds(): number[] {
    try {
        const ids = JSON.parse(fs.readFileSync(CURSEFORGE_ID_CACHE, 'utf-8'));
        return Array.isArray(ids) ? ids.filter((x) => typeof x === 'number') : [];
    } catch {
        return [];
    }
}

function saveCurseforgeIds(ids: number[]): void {
    if (ids.length === 0) return;
    try {
        fs.writeFileSync(CURSEFORGE_ID_CACHE, JSON.stringify(ids.sort((a, b) => a - b)));
    } catch (e) {
        console.error('[stats] could not save CurseForge IDs:', (e as Error).message);
    }
}
