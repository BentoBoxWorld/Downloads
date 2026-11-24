import axios from 'axios';
import * as cron from 'node-cron';
import { Request, Response } from 'express';
import { col, fn, Op, Sequelize } from 'sequelize';
import { Octokit } from 'octokit';
import { AddonsEntity } from '../config';
import { SnapshotAttributes, SnapshotFactory, SnapshotStatic } from './models/stats';
import { DownloadCounts, fetchCurseforge, fetchGithub, fetchHangar, fetchModrinth } from './downloadSources';
import { BRAND_GREEN, BRAND_INK, LOGO_SVG, parseColor, parseStyle, renderBadge } from './badge';

/**
 * Stats nexus: records a daily history of usage numbers from bStats and the
 * download site itself into data/Stats.sqlite, and serves them back out as
 * README badges and a JSON summary.
 *
 * Collected hourly (bStats samples every 30 min), stored one row per UTC day:
 *   servers / players / islands    daily peak of the 30-min samples
 *   islandsCreated                 daily sum (BentoBox reports a per-interval delta)
 *   addonServers / gameModeServers servers running each addon (bStats bar charts —
 *                                  current value only, no history upstream, so
 *                                  ours starts the day this runs)
 *   siteDownloads                  all-time ZIP download counter per addon
 *   githubDownloads / modrinthDownloads / hangarDownloads / curseforgeDownloads
 *                                  all-time totals per addon from each platform,
 *                                  fetched once per UTC day (retried hourly on failure)
 *
 * Line charts are backfilled from bStats' ~13 months of history on first run.
 */

const BSTATS = 'https://bstats.org/api/v1/plugins/3555/charts';

const LINE_CHARTS: { chart: string; agg: 'max' | 'sum' }[] = [
    { chart: 'servers', agg: 'max' },
    { chart: 'players', agg: 'max' },
    { chart: 'islands', agg: 'max' },
    { chart: 'islandsCreated', agg: 'sum' },
];

/** Platform download sources: metric name → fetcher. CurseForge is added when a key is configured. */
const SITE_METRIC = 'siteDownloads';
const PLATFORM_METRICS = ['githubDownloads', 'modrinthDownloads', 'hangarDownloads', 'curseforgeDownloads'];

const BAR_CHARTS: { chart: string; metric: string }[] = [
    { chart: 'addonsBar', metric: 'addonServers' },
    { chart: 'gameModeAddonsBar', metric: 'gameModeServers' },
];

/** Badge numbers use the peak over this many days, so they don't wobble daily. */
const PEAK_WINDOW_DAYS = 7;
/** Below this many servers the "servers" badge falls back to the Minecraft range. */
const MIN_SERVERS = 10;
/** Below this many downloads the "downloads" badge falls back to the Minecraft range. */
const MIN_DOWNLOADS = 100;
/** Rank badges only show a top-N placing; otherwise they fall back to servers. */
const MAX_RANK = 10;
/** 30-min samples to fetch on a normal hourly run: 48h, so yesterday is always complete. */
const RECENT_SAMPLES = 96;
const BACKFILL_SAMPLES = 20000;

export interface StatsDeps {
    /** The public (bucketed + ratcheted) BentoBox server count shown on the landing page. */
    serverCount: () => number;
    /** All-time ZIP downloads per addon name. */
    siteDownloads: () => Record<string, number>;
    /** The effective addon list from config.json + admin overrides. */
    addons: () => AddonsEntity[];
    /** Authenticated GitHub client (release asset download counts). */
    octokit: () => Octokit;
    /** CurseForge Core API key; CurseForge is skipped when absent. */
    curseforgeKey?: string;
}

export interface DownloadBreakdown {
    site: number;
    github: number;
    modrinth: number;
    hangar: number;
    curseforge: number;
}

export interface AddonStats {
    name: string;
    gamemode: boolean;
    /** Peak servers running it over the last week (bStats), or null if unknown. */
    servers: number | null;
    /** servers as a percentage of all BentoBox servers (rounded down). */
    share: number | null;
    /** 1-based popularity rank among addons (or game modes) on bStats. */
    rank: number | null;
    /** All-time downloads across every source (null when no source knows it). */
    downloads: number | null;
    downloadsBySource: DownloadBreakdown;
    mc: { min: string; max: string } | null;
    version: string | null;
}

export interface EcosystemStats {
    /** Public server count, as on the landing page. */
    servers: number;
    players: number | null;
    islands: number | null;
    islandsPerDay: number | null;
    /** All-time downloads of every addon (and BentoBox) across every source. */
    downloads: number;
}

interface PeakCache {
    addons: Record<string, { name: string; value: number; rank: number }>;
    gameModes: Record<string, { name: string; value: number; rank: number }>;
    rawServers: number | null;
    players: number | null;
    islands: number | null;
    islandsPerDay: number | null;
    /** Latest cumulative platform totals: metric → addon name → downloads. */
    platform: Record<string, DownloadCounts>;
}

interface BadgeContent {
    label: string;
    message: string;
    color?: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Case/space/punctuation-insensitive key: "Stranger Realms" ≡ "StrangerRealms". */
export function norm(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function utcDay(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
    return utcDay(Date.now() - n * 86400000);
}

/** 1759 → "1,759". For the non-negative integers the stats deal in. */
function withCommas(n: number): string {
    const digits = String(n);
    let out = '';
    for (let i = 0; i < digits.length; i++) {
        if (i > 0 && (digits.length - i) % 3 === 0) out += ',';
        out += digits.charAt(i);
    }
    return out;
}

function mcRange(mc: { min: string; max: string } | null): string {
    if (!mc) return 'latest';
    return mc.min === mc.max ? mc.max : `${mc.min} – ${mc.max}`;
}

/**
 * Round down to a friendly bucket and mark it as a lower bound:
 * 7 → "7", 55 → "50+", 890 → "850+", 1759 → "1,700+", 42310 → "42k+", 2661405 → "2.6M+".
 */
export function niceCount(n: number): string {
    if (n < 10) return String(n);
    if (n < 100) return `${Math.floor(n / 10) * 10}+`;
    if (n < 1000) return `${Math.floor(n / 50) * 50}+`;
    if (n < 10000) return `${withCommas(Math.floor(n / 100) * 100)}+`;
    if (n < 1000000) return `${Math.floor(n / 1000)}k+`;
    return `${Math.floor(n / 100000) / 10}M+`;
}

function versionKey(v: string): number[] {
    const m = /^\d+(?:\.\d+)*/.exec(v);
    return m ? m[0].split('.').map(Number) : [];
}

export function compareVersions(a: string, b: string): number {
    const x = versionKey(a);
    const y = versionKey(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
        const d = (x[i] ?? 0) - (y[i] ?? 0);
        if (d !== 0) return d;
    }
    return 0;
}

/** Competition ranking (1, 2, 2, 4) over a name → value map. */
function rank(values: Record<string, { name: string; value: number }>): void {
    const list = Object.keys(values).map((k) => values[k] as { name: string; value: number; rank?: number });
    list.sort((a, b) => b.value - a.value);
    list.forEach((e, i) => {
        e.rank = i > 0 && list[i - 1].value === e.value ? (list[i - 1].rank as number) : i + 1;
    });
}

// ── manager ──────────────────────────────────────────────────────────────────

export class StatsManager {
    private readonly sequelize = new Sequelize('stats', 'user', 'password', {
        host: 'localhost',
        dialect: 'sqlite',
        logging: false,
        storage: './../data/Stats.sqlite',
    });
    private readonly snapshots: SnapshotStatic = SnapshotFactory(this.sequelize);
    private cache: PeakCache = {
        addons: {},
        gameModes: {},
        rawServers: null,
        players: null,
        islands: null,
        islandsPerDay: null,
        platform: {},
    };
    private collecting = false;
    /** metric → UTC day of its last successful platform fetch. */
    private platformFetched: Record<string, string> = {};

    constructor(private readonly deps: StatsDeps) {
        this.snapshots
            .sync()
            .then(() => this.rebuildCache())
            .then(() => this.collect())
            .catch((e) => console.error('[stats] startup failed:', e?.message ?? e));
        // Hourly, offset from the 6-minute addon cron and the :17 server-count fetch.
        cron.schedule('23 * * * *', () => {
            this.collect().catch((e) => console.error('[stats] collect failed:', e?.message ?? e));
        });
    }

    // ── collection ──

    async collect(): Promise<void> {
        if (this.collecting) return;
        this.collecting = true;
        try {
            // Sequential on purpose: SQLite allows one writer at a time, and
            // parallel transactions fail with SQLITE_BUSY.
            const run = async (what: string, fn: () => Promise<void>) => {
                try {
                    await fn();
                } catch (e) {
                    console.error(`[stats] ${what} failed:`, (e as Error)?.message ?? e);
                }
            };
            for (const c of LINE_CHARTS) await run(c.chart, () => this.collectLine(c.chart, c.agg));
            for (const b of BAR_CHARTS) await run(b.chart, () => this.collectBar(b.chart, b.metric));
            await run(SITE_METRIC, () => this.collectSiteDownloads());
            await this.collectPlatforms(run);
            await this.rebuildCache();
        } finally {
            this.collecting = false;
        }
    }

    private async collectLine(chart: string, agg: 'max' | 'sum'): Promise<void> {
        const have = await this.snapshots.count({ where: { metric: chart } });
        const backfill = have < 30;
        const res = await axios.get(`${BSTATS}/${chart}/data`, {
            params: { maxElements: backfill ? BACKFILL_SAMPLES : RECENT_SAMPLES },
            timeout: 30000,
        });
        if (!Array.isArray(res.data)) throw new Error('unexpected bStats response');
        const byDay: Record<string, number> = {};
        for (const p of res.data as unknown[]) {
            if (!Array.isArray(p)) continue;
            const t = Number(p[0]);
            const v = Number(p[1]);
            if (!Number.isFinite(t) || !Number.isFinite(v) || v < 0) continue;
            const day = utcDay(t);
            byDay[day] = agg === 'sum' ? (byDay[day] ?? 0) + v : Math.max(byDay[day] ?? 0, v);
        }
        const rows = Object.keys(byDay).map((day) => ({ day, metric: chart, key: '', value: Math.round(byDay[day]) }));
        await this.upsertMax(rows);
        if (backfill) console.log(`[stats] backfilled ${rows.length} days of ${chart}`);
    }

    private async collectBar(chart: string, metric: string): Promise<void> {
        const res = await axios.get(`${BSTATS}/${chart}/data`, { timeout: 30000 });
        if (!Array.isArray(res.data)) throw new Error('unexpected bStats response');
        const day = utcDay(Date.now());
        const rows: SnapshotAttributes[] = [];
        for (const e of res.data as { name?: unknown; data?: unknown }[]) {
            const v = Array.isArray(e?.data) ? Number(e.data[0]) : Number.NaN;
            if (typeof e?.name !== 'string' || !e.name || e.name.length > 64 || !Number.isFinite(v)) continue;
            rows.push({ day, metric, key: e.name, value: Math.round(v) });
        }
        await this.upsertMax(rows);
    }

    private async collectSiteDownloads(): Promise<void> {
        await this.storeCounts(SITE_METRIC, this.deps.siteDownloads());
    }

    private async storeCounts(metric: string, counts: DownloadCounts): Promise<void> {
        const day = utcDay(Date.now());
        await this.upsertMax(Object.keys(counts).map((key) => ({ day, metric, key, value: counts[key] })));
    }

    /** Platform totals move slowly and GitHub costs a request per repo: once a day each. */
    private async collectPlatforms(run: (what: string, fn: () => Promise<void>) => Promise<void>): Promise<void> {
        const addons = this.deps.addons();
        if (addons.length === 0) return; // config not loaded yet — try next hour
        const sources: Record<string, () => Promise<DownloadCounts>> = {
            githubDownloads: () => fetchGithub(this.deps.octokit(), addons),
            modrinthDownloads: () => fetchModrinth(addons),
            hangarDownloads: () => fetchHangar(addons),
        };
        const cfKey = this.deps.curseforgeKey;
        if (cfKey) sources.curseforgeDownloads = () => fetchCurseforge(cfKey, addons);
        const today = utcDay(Date.now());
        for (const metric of Object.keys(sources)) {
            if (this.platformFetched[metric] === today) continue;
            await run(metric, async () => {
                const counts = await sources[metric]();
                await this.storeCounts(metric, counts);
                this.platformFetched[metric] = today;
                console.log(`[stats] ${metric}: ${Object.keys(counts).length} addons matched`);
            });
        }
    }

    /**
     * Insert rows, or raise existing ones. Never lowers a value: a day's
     * peak/sum only grows as more of that day's samples are seen, and partial
     * windows (e.g. the oldest day of a 48h fetch) must not overwrite the
     * complete figure recorded earlier.
     */
    private async upsertMax(rows: SnapshotAttributes[]): Promise<void> {
        if (rows.length === 0) return;
        const days = rows.map((r) => r.day).filter((d, i, a) => a.indexOf(d) === i);
        const metrics = rows.map((r) => r.metric).filter((m, i, a) => a.indexOf(m) === i);
        await this.sequelize.transaction(async (transaction) => {
            const existing = await this.snapshots.findAll({
                where: { metric: { [Op.in]: metrics }, day: { [Op.in]: days } },
                transaction,
            });
            const index: Record<string, typeof existing[number]> = {};
            for (const e of existing) index[`${e.day}|${e.metric}|${e.key}`] = e;
            for (const r of rows) {
                const cur = index[`${r.day}|${r.metric}|${r.key}`];
                if (!cur) await this.snapshots.create(r, { transaction });
                else if (r.value > cur.value) await cur.update({ value: r.value }, { transaction });
            }
        });
    }

    // ── derived numbers ──

    private async rebuildCache(): Promise<void> {
        const since = daysAgo(PEAK_WINDOW_DAYS - 1);
        const today = utcDay(Date.now());
        const rows = await this.snapshots.findAll({
            where: { day: { [Op.gte]: daysAgo(PEAK_WINDOW_DAYS) } },
        });

        const addons: PeakCache['addons'] = {};
        const gameModes: PeakCache['gameModes'] = {};
        let rawServers: number | null = null;
        let players: number | null = null;
        let islands: number | null = null;
        let createdSum = 0;
        let createdDays = 0;

        for (const r of rows) {
            // islandsCreated: average of complete days only (exclude today's partial).
            if (r.metric === 'islandsCreated') {
                if (r.day < today) {
                    createdSum += r.value;
                    createdDays++;
                }
                continue;
            }
            if (r.day < since) continue;
            const peak = (cur: number | null) => (cur === null ? r.value : Math.max(cur, r.value));
            if (r.metric === 'servers') rawServers = peak(rawServers);
            else if (r.metric === 'players') players = peak(players);
            else if (r.metric === 'islands') islands = peak(islands);
            else if (r.metric === 'addonServers' || r.metric === 'gameModeServers') {
                const map = r.metric === 'addonServers' ? addons : gameModes;
                const k = norm(r.key);
                if (!map[k] || map[k].value < r.value) map[k] = { name: r.key, value: r.value, rank: 0 };
            }
        }
        rank(addons);
        rank(gameModes);

        // Platform totals are cumulative, so the all-time max is the latest value.
        const platform: Record<string, DownloadCounts> = {};
        const totals = (await this.snapshots.findAll({
            attributes: ['metric', 'key', [fn('MAX', col('value')), 'value']],
            where: { metric: { [Op.in]: PLATFORM_METRICS } },
            group: ['metric', 'key'],
            raw: true,
        })) as unknown as SnapshotAttributes[];
        for (const t of totals) {
            if (!platform[t.metric]) platform[t.metric] = {};
            platform[t.metric][t.key] = Number(t.value);
        }

        this.cache = {
            addons,
            gameModes,
            rawServers,
            players,
            islands,
            islandsPerDay: createdDays > 0 ? Math.round(createdSum / createdDays) : null,
            platform,
        };
    }

    private findAddon(name: string): AddonsEntity | undefined {
        const k = norm(name);
        return this.deps.addons().find((a) => norm(a.name) === k);
    }

    addonStats(addon: AddonsEntity): AddonStats {
        const isCore = addon.name === 'BentoBox';
        const k = norm(addon.name);
        let entry: PeakCache['addons'][string] | undefined;
        if (!isCore) entry = addon.gamemode ? this.cache.gameModes[k] : this.cache.addons[k];

        let servers: number | null = entry ? entry.value : null;
        let share: number | null = null;
        if (isCore) servers = this.deps.serverCount();
        else if (entry && this.cache.rawServers) {
            share = Math.min(100, Math.floor((entry.value / this.cache.rawServers) * 100));
        }

        const keys = Object.keys(addon.versions ?? {})
            .filter((v) => /^\d+\.\d+/.test(v))
            .sort(compareVersions);
        const mc = keys.length ? { min: keys[0], max: keys[keys.length - 1] } : null;
        const version = keys.length ? (addon.versions as Record<string, string>)[keys[keys.length - 1]] : null;

        const bySource = this.downloadsOf(addon.name);
        const dl = bySource
            ? bySource.site + bySource.github + bySource.modrinth + bySource.hangar + bySource.curseforge
            : null;

        return {
            name: addon.name,
            gamemode: addon.gamemode,
            servers,
            share,
            rank: entry ? entry.rank : null,
            downloads: dl,
            downloadsBySource: bySource ?? { site: 0, github: 0, modrinth: 0, hangar: 0, curseforge: 0 },
            mc,
            version,
        };
    }

    /** Per-source downloads for one addon, or null if no source has a number for it. */
    private downloadsOf(name: string): DownloadBreakdown | null {
        const p = this.cache.platform;
        const pick = (counts: DownloadCounts | undefined) =>
            counts && typeof counts[name] === 'number' ? counts[name] : null;
        const site = pick(this.deps.siteDownloads());
        const github = pick(p.githubDownloads);
        const modrinth = pick(p.modrinthDownloads);
        const hangar = pick(p.hangarDownloads);
        const curseforge = pick(p.curseforgeDownloads);
        if ([site, github, modrinth, hangar, curseforge].every((v) => v === null)) return null;
        return {
            site: site ?? 0,
            github: github ?? 0,
            modrinth: modrinth ?? 0,
            hangar: hangar ?? 0,
            curseforge: curseforge ?? 0,
        };
    }

    ecosystemStats(): EcosystemStats {
        let downloads = 0;
        for (const a of this.deps.addons()) {
            const d = this.downloadsOf(a.name);
            if (d) downloads += d.site + d.github + d.modrinth + d.hangar + d.curseforge;
        }
        return {
            downloads,
            servers: this.deps.serverCount(),
            players: this.cache.players,
            islands: this.cache.islands,
            islandsPerDay: this.cache.islandsPerDay,
        };
    }

    // ── badge content ──

    private addonBadge(s: AddonStats, metric: string): BadgeContent | null {
        const mc = (): BadgeContent => ({
            label: 'Minecraft',
            message: mcRange(s.mc),
        });
        const servers = (): BadgeContent => {
            if (s.servers === null || s.servers < MIN_SERVERS) return mc();
            // BentoBox's count is already bucketed by ServerStats.
            const count = s.name === 'BentoBox' ? withCommas(s.servers) + '+' : niceCount(s.servers);
            return { label: 'used on', message: `${count} servers` };
        };
        switch (metric) {
            case 'servers':
                return servers();
            case 'share':
                return s.share !== null && s.share >= 1
                    ? { label: 'used by', message: `${s.share}% of BentoBox servers` }
                    : servers();
            case 'rank':
                return s.rank !== null && s.rank <= MAX_RANK
                    ? { label: 'popularity', message: `#${s.rank} most-used ${s.gamemode ? 'game mode' : 'addon'}` }
                    : servers();
            case 'downloads':
                return s.downloads !== null && s.downloads >= MIN_DOWNLOADS
                    ? { label: 'downloads', message: niceCount(s.downloads) }
                    : mc();
            case 'mc':
                return mc();
            case 'version':
                return s.version ? { label: 'version', message: `v${s.version.replace(/^v/i, '')}` } : mc();
            default:
                return null;
        }
    }

    private ecosystemBadge(metric: string): BadgeContent | null {
        const e = this.ecosystemStats();
        switch (metric) {
            case 'servers':
                return { label: 'BentoBox', message: `${withCommas(e.servers)}+ servers` };
            case 'players':
                return e.players ? { label: 'players online', message: niceCount(e.players) } : null;
            case 'islands':
                return e.islands ? { label: 'BentoBox', message: `${niceCount(e.islands)} islands` } : null;
            case 'downloads':
                return e.downloads >= MIN_DOWNLOADS
                    ? { label: 'BentoBox', message: `${niceCount(e.downloads)} downloads` }
                    : null;
            case 'islands-created':
                return e.islandsPerDay
                    ? { label: 'new islands', message: `${niceCount(e.islandsPerDay)} a day` }
                    : null;
            default:
                return null;
        }
    }

    /** Resolve /badge/<metric> or /badge/<addon>/<metric> to badge content; null = 404. */
    private resolve(params: { addon?: string; metric?: string }): BadgeContent | null {
        const metric = String(params.metric ?? '').toLowerCase();
        if (!params.addon) return this.ecosystemBadge(metric);
        const addon = this.findAddon(String(params.addon));
        if (!addon) return null;
        // BentoBox's own "servers" is the ecosystem number.
        return this.addonBadge(this.addonStats(addon), metric);
    }

    // ── handlers ──

    private setCacheHeaders(res: Response): void {
        // GitHub's camo proxy honours these; an hour matches the collect cadence.
        res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
        res.set('Access-Control-Allow-Origin', '*');
    }

    /** GET /badge/:metric.svg and /badge/:addon/:metric.svg */
    handleBadgeSvg = (req: Request, res: Response): void => {
        const content = this.resolve(req.params);
        const q = req.query;
        const svg = renderBadge({
            label: typeof q.label === 'string' && q.label.length <= 40 ? q.label : content?.label ?? 'badge',
            message: content?.message ?? 'not found',
            color: content ? parseColor(q.color, content.color ?? BRAND_GREEN) : '#9f9f9f',
            labelColor: parseColor(q.labelColor, BRAND_INK),
            style: parseStyle(q.style),
            logo: q.logo !== 'false' && q.logo !== '0',
        });
        this.setCacheHeaders(res);
        res.status(content ? 200 : 404)
            .type('image/svg+xml')
            .send(svg);
    };

    /** GET /api/badge/:metric and /api/badge/:addon/:metric — shields.io endpoint schema. */
    handleBadgeJson = (req: Request, res: Response): void => {
        const content = this.resolve(req.params);
        this.setCacheHeaders(res);
        if (!content) {
            res.status(404).json({ schemaVersion: 1, label: 'badge', message: 'not found', isError: true });
            return;
        }
        res.json({
            schemaVersion: 1,
            label: content.label,
            message: content.message,
            color: content.color ?? BRAND_GREEN,
            labelColor: BRAND_INK,
            logoSvg: LOGO_SVG,
            cacheSeconds: 3600,
        });
    };

    /** GET /api/stats/addons — everything the badges know, for the future stats page. */
    handleSummary = (_req: Request, res: Response): void => {
        this.setCacheHeaders(res);
        res.json({
            ecosystem: this.ecosystemStats(),
            addons: this.deps.addons().map((a) => this.addonStats(a)),
        });
    };
}
