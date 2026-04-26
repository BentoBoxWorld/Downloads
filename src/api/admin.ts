import { RequestHandler } from 'express';
import { PresetsEntity } from '../config';
import { AuthedRequest, AuthManager } from './auth';
import { ConfigStore } from './configStore';

const DISCORD_ID_RE = /^[0-9]{15,25}$/;
const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;
const MAX_PRESETS = 50;
const MAX_NAME_LEN = 80;
const MAX_TEXT_LEN = 2000;
const MAX_ADDONS_PER_PRESET = 50;

export class AdminManager {
    constructor(
        private readonly auth: AuthManager,
        private readonly configStore: ConfigStore,
        private readonly reload: () => Promise<void>,
    ) {}

    handleListAdmins: RequestHandler = async (_req, res) => {
        const admins = await this.auth.listAdmins();
        res.json(admins);
    };

    handleSetAdmin: RequestHandler = async (req, res) => {
        const body = (req.body ?? {}) as { discordId?: unknown; isAdmin?: unknown };
        const discordId = typeof body.discordId === 'string' ? body.discordId.trim() : '';
        const isAdmin = body.isAdmin === true;

        if (!DISCORD_ID_RE.test(discordId)) {
            res.status(400).json({ error: 'invalid_discord_id' });
            return;
        }
        if (typeof body.isAdmin !== 'boolean') {
            res.status(400).json({ error: 'invalid_is_admin' });
            return;
        }

        const actor = (req as AuthedRequest).user;
        if (actor && actor.id === discordId && !isAdmin) {
            res.status(400).json({ error: 'cannot_demote_self' });
            return;
        }

        await this.auth.setAdmin(discordId, isAdmin);
        res.json({ ok: true });
    };

    handleListPresets: RequestHandler = async (_req, res) => {
        res.json(this.configStore.getEffectiveConfig().presets);
    };

    handleUpdatePresets: RequestHandler = async (req, res) => {
        const result = validatePresets(
            req.body,
            new Set(this.configStore.getEffectiveConfig().addons.map((a) => a.name)),
        );
        if (!result.ok) {
            res.status(400).json({ error: 'invalid_presets', issues: result.issues });
            return;
        }

        const actor = (req as AuthedRequest).user;
        await this.configStore.setOverride(
            'presets',
            result.value,
            actor?.id ?? '',
            `updated presets list (${result.value.length} entries)`,
        );
        await this.reload();
        res.json({ ok: true });
    };
}

function validatePresets(
    raw: unknown,
    knownAddons: Set<string>,
): { ok: true; value: PresetsEntity[] } | { ok: false; issues: string[] } {
    const issues: string[] = [];
    if (!Array.isArray(raw)) {
        return { ok: false, issues: ['body must be an array of presets'] };
    }
    if (raw.length > MAX_PRESETS) {
        issues.push(`too many presets (max ${MAX_PRESETS})`);
    }

    const seen = new Set<string>();
    const value: PresetsEntity[] = [];

    raw.forEach((entry, i) => {
        if (typeof entry !== 'object' || entry === null) {
            issues.push(`preset[${i}] must be an object`);
            return;
        }
        const e = entry as Record<string, unknown>;

        const name = strField(e, 'name', i, issues, { required: true, max: MAX_NAME_LEN });
        const description = strField(e, 'description', i, issues, { max: MAX_TEXT_LEN }) ?? '';
        const subtext = strField(e, 'subtext', i, issues, { max: MAX_TEXT_LEN }) ?? '';
        const color = strField(e, 'color', i, issues, { required: true, max: 16 });
        const dependencyText =
            'dependencyText' in e
                ? strField(e, 'dependencyText', i, issues, { max: MAX_TEXT_LEN })
                : undefined;

        if (color && !COLOR_RE.test(color)) {
            issues.push(`preset[${i}].color must be a hex string like #ffdd57`);
        }
        if (name) {
            if (seen.has(name)) {
                issues.push(`preset[${i}].name "${name}" is duplicated`);
            } else {
                seen.add(name);
            }
        }

        const addons = stringArrayField(e, 'addons', i, issues, knownAddons, {
            required: true,
            max: MAX_ADDONS_PER_PRESET,
        });
        const dependencies =
            'dependencies' in e && e.dependencies !== undefined
                ? stringArrayField(e, 'dependencies', i, issues, knownAddons, {
                      max: MAX_ADDONS_PER_PRESET,
                  })
                : undefined;

        if (!name || !color || !addons) return;

        const out: PresetsEntity = {
            name,
            description,
            subtext,
            addons,
            color,
        };
        if (dependencies !== undefined) out.dependencies = dependencies;
        if (dependencyText !== undefined) out.dependencyText = dependencyText;
        value.push(out);
    });

    if (issues.length) return { ok: false, issues };
    return { ok: true, value };
}

function strField(
    obj: Record<string, unknown>,
    key: string,
    i: number,
    issues: string[],
    opts: { required?: boolean; max?: number },
): string | undefined {
    const v = obj[key];
    if (v === undefined || v === null || v === '') {
        if (opts.required) issues.push(`preset[${i}].${key} is required`);
        return undefined;
    }
    if (typeof v !== 'string') {
        issues.push(`preset[${i}].${key} must be a string`);
        return undefined;
    }
    if (opts.max !== undefined && v.length > opts.max) {
        issues.push(`preset[${i}].${key} is too long (max ${opts.max})`);
        return undefined;
    }
    return v;
}

function stringArrayField(
    obj: Record<string, unknown>,
    key: string,
    i: number,
    issues: string[],
    knownAddons: Set<string>,
    opts: { required?: boolean; max?: number },
): string[] | undefined {
    const v = obj[key];
    if (v === undefined || v === null) {
        if (opts.required) issues.push(`preset[${i}].${key} is required`);
        return undefined;
    }
    if (!Array.isArray(v)) {
        issues.push(`preset[${i}].${key} must be an array of addon names`);
        return undefined;
    }
    if (opts.max !== undefined && v.length > opts.max) {
        issues.push(`preset[${i}].${key} has too many entries (max ${opts.max})`);
        return undefined;
    }
    const out: string[] = [];
    for (const item of v) {
        if (typeof item !== 'string') {
            issues.push(`preset[${i}].${key} contains a non-string entry`);
            continue;
        }
        if (!knownAddons.has(item)) {
            issues.push(`preset[${i}].${key} references unknown addon "${item}"`);
            continue;
        }
        out.push(item);
    }
    return out;
}
