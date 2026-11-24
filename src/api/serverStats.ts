import axios from 'axios';
import * as cron from 'node-cron';
import * as fs from 'node:fs';
import { Request, Response } from 'express';

/**
 * Server count shown on the landing page, sourced from bStats
 * (https://bstats.org/plugin/bukkit/BentoBox/3555).
 *
 * The raw count swings through the day, so the public number is:
 *   1. the PEAK over the last 24h of samples (absorbs the daily cycle),
 *   2. floored to a bucket of 100 ("1,759" -> "1,700+"),
 *   3. ratcheted: it rises as soon as the peak clears the next bucket, but
 *      only falls when the peak drops more than DROP_FRACTION below the
 *      number currently shown (hysteresis).
 * The shown value is persisted so restarts don't reset the ratchet.
 */

const BSTATS_URL = 'https://bstats.org/api/v1/plugins/3555/charts/servers/data';
/** bStats samples every 30 minutes, so 48 points ≈ 24 hours. */
const SAMPLES = 48;
const BUCKET = 100;
const DROP_FRACTION = 0.05;
/** Used until the first successful fetch (and no persisted value exists). */
const FALLBACK = 1600;
const STATE_FILE = './../data/ServerStats.json';

export interface ServerStatsState {
    /** The number shown publicly, e.g. 1700 → "1,700+". */
    servers: number;
    /** 24h peak observed on the last successful fetch. */
    peak: number;
    /** Epoch ms of the last successful fetch. */
    updatedAt: number;
}

/** Pure ratchet step — exported so the rule is easy to reason about/test. */
export function ratchet(current: number | null, peak: number): number {
    const bucket = Math.floor(peak / BUCKET) * BUCKET;
    if (current === null || bucket >= current) return bucket;
    // Below the shown value: only drop on a meaningful decline.
    return peak < current * (1 - DROP_FRACTION) ? bucket : current;
}

export class ServerStats {
    private state: ServerStatsState | null = null;

    constructor() {
        try {
            const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
            if (typeof parsed?.servers === 'number' && parsed.servers > 0) this.state = parsed;
        } catch {
            /* no saved state yet */
        }
    }

    /** First fetch plus the hourly refresh. Call once, right after construction. */
    start(): void {
        this.refresh().catch((e) => console.error('[stats] initial fetch failed:', e?.message ?? e));
        // Hourly, offset from the 6-minute addon cron.
        cron.schedule('17 * * * *', () => {
            this.refresh().catch((e) => console.error('[stats] fetch failed:', e?.message ?? e));
        });
    }

    get servers(): number {
        return this.state?.servers ?? FALLBACK;
    }

    async refresh(): Promise<void> {
        const res = await axios.get(BSTATS_URL, {
            params: { maxElements: SAMPLES },
            timeout: 15000,
        });
        const points: unknown = res.data;
        if (!Array.isArray(points)) throw new Error('unexpected bStats response');
        const values = points
            .map((p) => (Array.isArray(p) ? Number(p[1]) : Number.NaN))
            .filter((v) => Number.isFinite(v) && v > 0);
        if (values.length === 0) throw new Error('bStats returned no data points');

        const peak = Math.max(...values);
        const servers = ratchet(this.state?.servers ?? null, peak);
        if (servers !== this.state?.servers) {
            console.log(`[stats] server count ${this.state?.servers ?? '(none)'} -> ${servers} (24h peak ${peak})`);
        }
        this.state = { servers, peak, updatedAt: Date.now() };
        try {
            fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
        } catch (e) {
            console.error('[stats] could not persist state:', (e as Error).message);
        }
    }

    handleGet = (_req: Request, res: Response): void => {
        res.set('Cache-Control', 'public, max-age=600');
        res.json({ servers: this.servers });
    };
}
