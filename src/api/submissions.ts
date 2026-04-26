import { RequestHandler } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { Octokit } from 'octokit';
import multer = require('multer');
import Ajv2020 from 'ajv/dist/2020';
import { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { AuthedRequest, AuthManager, TERMS_VERSION } from './auth';
import { CatalogOverlay, computeStats, parseBlueprintId } from './blueprintCatalog';
import { WeblinkSync } from './weblink';
import schema from './schemas/blueprint.schema.json';
import { validateBlueprintSubmission } from './blueprintCatalog';

// 5 MB cap.
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 20 },
});

interface SubmissionsConfig {
    weblinkRepo: { owner: string; repo: string }; // BentoBoxWorld/weblink
    weblinkToken: string;                          // env.weblink_github_token
    weblinkBranch: string;                         // master
}

export class SubmissionManager {
    private validate: ValidateFunction;
    private octokit: Octokit | null;

    constructor(
        private readonly auth: AuthManager,
        private readonly weblink: WeblinkSync,
        private readonly cfg: SubmissionsConfig | null,
    ) {
        const ajv = new Ajv2020({ allErrors: false, strict: false });
        addFormats(ajv);
        // The full schema accepts either Blueprint or BlueprintBundle; for
        // submissions we restrict to Blueprint. Register the full schema so
        // $ref resolution works, then compile against the Blueprint subschema.
        ajv.addSchema(schema as object, schema.$id);
        this.validate = ajv.compile({
            $ref: `${schema.$id}#/$defs/Blueprint`,
        });

        this.octokit = cfg ? new Octokit({ auth: cfg.weblinkToken }) : null;
    }

    isConfigured(): boolean {
        return !!this.cfg && !!this.octokit;
    }

    handleSubmit: RequestHandler = async (req, res) => {
        const ar = req as AuthedRequest;
        if (!ar.session || !ar.user) {
            res.status(401).json({ error: 'unauthenticated' });
            return;
        }
        if (!this.cfg || !this.octokit) {
            res.status(503).json({ error: 'submissions disabled', reason: 'weblink_github_token not configured' });
            return;
        }

        // multer attaches the file to req.file and form fields to req.body.
        type WithFile = typeof req & {
            file?: Express.Multer.File;
            body: Record<string, string>;
        };
        const r = req as WithFile;
        if (!r.file) {
            res.status(400).json({ error: 'no_file', reason: 'Missing blueprint file.' });
            return;
        }

        const gameMode = (r.body.gameMode || '').trim();
        const name = (r.body.name || '').trim();
        const displayName = (r.body.displayName || '').trim();
        const description = parseDescription(r.body.description);
        const tags = parseTags(r.body.tags);
        const acceptedTerms = r.body.acceptedTerms === 'true' || r.body.acceptedTerms === 'on';

        // 1. Required fields.
        if (!gameMode || !name || !displayName) {
            res.status(400).json({ error: 'missing_fields' });
            return;
        }
        if (!acceptedTerms) {
            res.status(400).json({ error: 'terms_not_accepted' });
            return;
        }

        // 2. Slug regex (matches the same one used for path resolution).
        if (!parseBlueprintId(`${gameMode}/${name}`)) {
            res.status(400).json({ error: 'bad_id', reason: 'gameMode/name has invalid characters.' });
            return;
        }

        // 3. Rate limit.
        const quota = this.auth.consumeSubmissionQuota(ar.user.id);
        if (!quota.ok) {
            res.status(429).json({ error: 'rate_limited', reason: quota.reason });
            return;
        }

        // 4. JSON parse.
        let parsed: unknown;
        try {
            parsed = JSON.parse(r.file.buffer.toString('utf-8'));
        } catch {
            res.status(400).json({ error: 'invalid_json', reason: 'Blueprint is not valid JSON.' });
            return;
        }

        // 4a. Gson serializes empty Map<Vector, X> as `{}` rather than `[]`,
        // even when complex-map-key serialization is enabled. The schema
        // declares those fields as arrays, so coerce the empty-object form
        // before validation. The PR keeps the user's original bytes.
        const normalized = normalizeForValidation(parsed);

        // 5. Schema validation.
        if (!this.validate(normalized)) {
            const errors = (this.validate.errors ?? []).slice(0, 5).map((e) => {
                const path = e.instancePath || '/';
                const params = e.params as Record<string, unknown> | undefined;
                if (e.keyword === 'additionalProperties' && params && 'additionalProperty' in params) {
                    return `${path}: unknown field "${params.additionalProperty}"`;
                }
                if (e.keyword === 'required' && params && 'missingProperty' in params) {
                    return `${path}: missing required field "${params.missingProperty}"`;
                }
                if (e.keyword === 'enum' && params && 'allowedValues' in params) {
                    return `${path}: must be one of ${(params.allowedValues as unknown[]).join(', ')}`;
                }
                return `${path}: ${e.message ?? 'invalid'}`;
            });
            res.status(400).json({ error: 'schema_failed', issues: errors });
            return;
        }

        // 6. Sanitiser.
        const sanitised = validateBlueprintSubmission(parsed);
        if (!sanitised.ok) {
            res.status(400).json({
                error: 'sanitiser_rejected',
                issues: sanitised.issues.map((i) => `${i.field}: ${i.reason}`),
            });
            return;
        }

        // 7. Local slug collision check (against the cached weblink clone).
        const localTarget = path.join(this.weblink.blueprintsDir, gameMode, `${name}.blueprint`);
        if (fs.existsSync(localTarget)) {
            res.status(409).json({ error: 'name_taken', reason: `${gameMode}/${name} already exists.` });
            return;
        }

        // 8. Stats summary for the PR body.
        const bp = parsed as Parameters<typeof computeStats>[0];
        const stats = computeStats(bp);

        // 9. Mark terms accepted.
        await this.auth.recordTermsAccepted(ar.user.id, TERMS_VERSION);

        // 10. Open the PR.
        try {
            const pretty = JSON.stringify(parsed, null, 2);
            const updatedCatalog = await this.patchedCatalog({
                id: `${gameMode}/${name}`,
                displayName,
                description,
                authorDiscordId: ar.user.id,
                authorUsername: r.body.username || '',
                tags,
            });

            const prUrl = await this.openPullRequest({
                discordUserId: ar.user.id,
                gameMode,
                name,
                displayName,
                statsSummary: summariseStats(stats, displayName, gameMode, name),
                blueprintBody: pretty,
                catalogBody: updatedCatalog,
            });

            // Record locally.
            await this.auth.submissions.create({
                userId: ar.user.id,
                gameMode,
                name,
                displayName,
                prUrl,
                termsVersion: TERMS_VERSION,
                createdAt: Date.now(),
            } as never);

            res.json({ ok: true, prUrl });
        } catch (err) {
            const e = err as Error & {
                status?: number;
                response?: { data?: { message?: string; errors?: unknown } };
            };
            const detail =
                e.response?.data?.message ||
                e.message ||
                'unknown error';
            console.error('[submission] PR creation failed.', {
                status: e.status,
                message: e.message,
                githubMessage: e.response?.data?.message,
                githubErrors: e.response?.data?.errors,
            });
            res.status(502).json({
                error: 'pr_failed',
                reason: `Could not open pull request on weblink: ${detail}`,
            });
        }
    };

    handleMySubmissions: RequestHandler = async (req, res) => {
        const ar = req as AuthedRequest;
        if (!ar.user) {
            res.status(401).json({ error: 'unauthenticated' });
            return;
        }
        const rows = await this.auth.submissions.findAll({
            where: { userId: ar.user.id },
            order: [['createdAt', 'DESC']],
            limit: 50,
        });
        res.json(
            rows.map((r) => ({
                gameMode: r.gameMode,
                name: r.name,
                displayName: r.displayName,
                prUrl: r.prUrl,
                createdAt: r.createdAt,
            })),
        );
    };

    // ----- GitHub plumbing -----

    private async patchedCatalog(entry: {
        id: string;
        displayName: string;
        description: string[];
        authorDiscordId: string;
        authorUsername: string;
        tags: string[];
    }): Promise<string> {
        // Read current catalog.json from the weblink clone (or default to empty).
        const catalogPath = path.join(this.weblink.blueprintsDir, 'catalog.json');
        let overlay: CatalogOverlay = {};
        if (fs.existsSync(catalogPath)) {
            try {
                overlay = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
            } catch {
                /* fall through to empty */
            }
        }
        if (!overlay.blueprints) overlay.blueprints = {};
        overlay.blueprints[entry.id] = {
            displayName: entry.displayName,
            description: entry.description,
            author: entry.authorUsername || `Discord:${entry.authorDiscordId}`,
            authorLink: `https://discord.com/users/${entry.authorDiscordId}`,
            tags: entry.tags.length ? entry.tags : undefined,
            license: 'EPL-2.0',
        };
        return JSON.stringify(overlay, null, 2) + '\n';
    }

    private async openPullRequest(args: {
        discordUserId: string;
        gameMode: string;
        name: string;
        displayName: string;
        statsSummary: string;
        blueprintBody: string;
        catalogBody: string;
    }): Promise<string> {
        if (!this.cfg || !this.octokit) throw new Error('submissions disabled');
        const { owner, repo } = this.cfg.weblinkRepo;
        const baseBranch = this.cfg.weblinkBranch;

        // Get base branch SHA.
        const baseRef = await this.octokit.rest.git.getRef({
            owner,
            repo,
            ref: `heads/${baseBranch}`,
        });
        const baseSha = baseRef.data.object.sha;

        // Branch name. Timestamp avoids collision when a user resubmits.
        const branch = `submit/${args.discordUserId}/${args.gameMode}-${args.name}-${Date.now()}`;
        await this.octokit.rest.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${branch}`,
            sha: baseSha,
        });

        // Commit blueprint.
        await this.octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            branch,
            path: `blueprints/${args.gameMode}/${args.name}.blueprint`,
            message: `Add blueprint ${args.gameMode}/${args.name}`,
            content: Buffer.from(args.blueprintBody, 'utf-8').toString('base64'),
        });

        // Commit catalog (need its current SHA to update in place).
        let catalogSha: string | undefined;
        try {
            const existing = await this.octokit.rest.repos.getContent({
                owner,
                repo,
                path: 'blueprints/catalog.json',
                ref: branch,
            });
            if (!Array.isArray(existing.data) && existing.data.type === 'file') {
                catalogSha = existing.data.sha;
            }
        } catch {
            /* no catalog yet */
        }
        await this.octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            branch,
            path: 'blueprints/catalog.json',
            message: `Update catalog for ${args.gameMode}/${args.name}`,
            content: Buffer.from(args.catalogBody, 'utf-8').toString('base64'),
            sha: catalogSha,
        });

        // Open PR.
        const pr = await this.octokit.rest.pulls.create({
            owner,
            repo,
            head: branch,
            base: baseBranch,
            title: `Submission: ${args.displayName} (${args.gameMode}/${args.name})`,
            body:
                `Submitted via the Downloads site by Discord user \`${args.discordUserId}\`.\n\n` +
                `Terms accepted: ${TERMS_VERSION}\n\n` +
                `### Stats\n\n${args.statsSummary}\n`,
        });
        return pr.data.html_url;
    }
}

// ----- helpers -----

function normalizeForValidation(input: unknown): unknown {
    if (typeof input !== 'object' || input === null) return input;
    const out: Record<string, unknown> = { ...(input as Record<string, unknown>) };
    for (const key of ['blocks', 'attached', 'entities']) {
        const v = out[key];
        if (
            v &&
            typeof v === 'object' &&
            !Array.isArray(v) &&
            Object.keys(v as Record<string, unknown>).length === 0
        ) {
            out[key] = [];
        }
    }
    return out;
}

function parseDescription(raw: string | undefined): string[] {
    if (!raw) return [];
    return raw
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, 10);
}

function parseTags(raw: string | undefined): string[] {
    if (!raw) return [];
    return raw
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => /^[a-z0-9_-]{2,24}$/.test(t))
        .slice(0, 8);
}

function summariseStats(
    s: ReturnType<typeof computeStats>,
    displayName: string,
    gameMode: string,
    name: string,
): string {
    const lines: string[] = [];
    lines.push(`- **Display name:** ${displayName}`);
    lines.push(`- **Path:** \`${gameMode}/${name}.blueprint\``);
    lines.push(`- **Dimensions:** ${s.dimensions.x} × ${s.dimensions.y} × ${s.dimensions.z}`);
    lines.push(`- **Blocks:** ${s.blockCount}, attached: ${s.attachedCount}, air: ${s.airCount}`);
    lines.push(`- **Entities:** ${s.entityCount}`);
    if (s.biomes.length) lines.push(`- **Biomes:** ${s.biomes.join(', ')}`);
    if (s.sinking) lines.push(`- **Sinking:** yes`);
    if (s.topBlocks.length) {
        lines.push(`- **Top blocks:** ${s.topBlocks.map((b) => `${b.material}×${b.count}`).join(', ')}`);
    }
    if (s.topEntities.length) {
        lines.push(`- **Top entities:** ${s.topEntities.map((e) => `${e.type}×${e.count}`).join(', ')}`);
    }
    return lines.join('\n');
}
