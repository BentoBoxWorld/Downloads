import * as fs from 'fs';
import apiClass from '../api/api';
import { ConfigObject } from '../config';

/* Run as: `yarn build && yarn prime-cache` (or directly:
 *   cd dist && node scripts/prime-cache.js).
 * This pulls the latest GitHub release + Jenkins build for every addon
 * in config.json and writes them into JarCache.sqlite, bypassing the
 * 6-minute cron drip-feed in api.ts.
 *
 * Without a real `github_token` in env.json this is rate-limited to ~60
 * requests/hour and will fail partway. Set a token first.
 */

function envHasRealToken(): boolean {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const env = require('./../../env.json') as { github_token?: string };
        return !!env.github_token && !env.github_token.includes('XXXX');
    } catch {
        return false;
    }
}

async function withConcurrency<T>(
    items: T[],
    limit: number,
    label: (item: T) => string,
    worker: (item: T) => Promise<unknown>,
): Promise<void> {
    const queue = items.slice();
    const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
        while (queue.length) {
            const next = queue.shift();
            if (!next) return;
            const tag = label(next);
            try {
                await worker(next);
                process.stdout.write(`  ✓ ${tag}\n`);
            } catch (err) {
                process.stdout.write(`  ✗ ${tag}: ${(err as Error).message}\n`);
            }
        }
    });
    await Promise.all(runners);
}

const config: ConfigObject = JSON.parse(
    fs.readFileSync('./../config.json').toString(),
);

const api = new apiClass(config);

(async () => {
    if (!envHasRealToken()) {
        console.warn(
            '\n[prime] WARNING: env.json has no real github_token (still the ghp_XXXX placeholder).',
        );
        console.warn(
            '[prime] Anonymous GitHub calls are capped at 60/hour — this run will likely fail partway.',
        );
        console.warn(
            '[prime] Generate a PAT at https://github.com/settings/tokens (no scopes needed for public repos),',
        );
        console.warn('[prime] paste it into env.json under "github_token", then re-run.\n');
    }

    /* Give ApiManager a moment to open and sync JarCache before we start
     * dropping rows in. */
    await new Promise((r) => setTimeout(r, 1500));

    const addons = config.addons;
    console.log(
        `[prime] ${addons.length} addons — fetching latest GitHub releases (concurrency 6)…`,
    );
    await withConcurrency(
        addons,
        6,
        (a) => a.name,
        (a) => api.updateAsset(a),
    );

    console.log(
        `[prime] fetching Jenkins CI builds (concurrency 4)…`,
    );
    await withConcurrency(
        addons,
        4,
        (a) => `${a.name} (CI)`,
        (a) => api.updateJenkins(a),
    );

    console.log('[prime] done. Cache populated.');
    process.exit(0);
})().catch((err) => {
    console.error('[prime] fatal:', err);
    process.exit(1);
});
