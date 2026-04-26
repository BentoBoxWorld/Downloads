import { RequestHandler } from 'express';
import { AddonsEntity, PresetsEntity } from '../config';
import { AuthedRequest, AuthManager } from './auth';
import { ConfigStore } from './configStore';

const DISCORD_ID_RE = /^[0-9]{15,25}$/;
const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;
const ADDON_NAME_RE = /^[A-Za-z0-9 _-]+$/;
const GITHUB_REPO_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
// Permissive: real config has entries like "1.16-Java16" and "1.11.0.2",
// and future Minecraft is moving to a different scheme entirely.
const MC_VERSION_RE = /^[A-Za-z0-9._-]{1,32}$/;
const MAX_PRESETS = 50;
const MAX_NAME_LEN = 80;
const MAX_TEXT_LEN = 2000;
const MAX_DESCRIPTION_LEN = 4000;
const MAX_ADDONS_PER_PRESET = 50;
const MAX_VERSION_VALUE_LEN = 50;
const MAX_VERSIONS_PER_ADDON = 50;
const PROTECTED_ADDON_NAMES = new Set(['BentoBox']);

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

    handleListAddons: RequestHandler = async (_req, res) => {
        res.json(this.configStore.getEffectiveConfig().addons);
    };

    handleCreateAddon: RequestHandler = async (req, res) => {
        const result = validateAddon(req.body);
        if (!result.ok) {
            res.status(400).json({ error: 'invalid_addon', issues: result.issues });
            return;
        }
        const current = this.configStore.getEffectiveConfig().addons;
        if (current.some((a) => a.name === result.value.name)) {
            res.status(409).json({ error: 'name_taken' });
            return;
        }
        const next = [...current, result.value];
        await this.persistAddons(next, req, `created addon "${result.value.name}"`);
        res.json({ ok: true, addon: result.value });
    };

    handleUpdateAddon: RequestHandler = async (req, res) => {
        const targetName = String((req.params as Record<string, string>).name ?? '');
        const current = this.configStore.getEffectiveConfig().addons;
        const idx = current.findIndex((a) => a.name === targetName);
        if (idx < 0) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        const incoming = (req.body ?? {}) as Record<string, unknown>;
        // Lock the name on update — presets reference addons by name.
        if (typeof incoming.name === 'string' && incoming.name !== targetName) {
            res.status(400).json({ error: 'name_immutable' });
            return;
        }
        const result = validateAddon({ ...incoming, name: targetName });
        if (!result.ok) {
            res.status(400).json({ error: 'invalid_addon', issues: result.issues });
            return;
        }
        const next = current.map((a, i) => (i === idx ? result.value : a));
        await this.persistAddons(next, req, `updated addon "${targetName}"`);
        res.json({ ok: true, addon: result.value });
    };

    handleDeleteAddon: RequestHandler = async (req, res) => {
        const targetName = String((req.params as Record<string, string>).name ?? '');
        if (PROTECTED_ADDON_NAMES.has(targetName)) {
            res.status(400).json({ error: 'protected_addon' });
            return;
        }
        const cfg = this.configStore.getEffectiveConfig();
        if (!cfg.addons.some((a) => a.name === targetName)) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        const blockingPresets = cfg.presets
            .filter(
                (p) =>
                    p.addons.includes(targetName) ||
                    (p.dependencies && p.dependencies.includes(targetName)),
            )
            .map((p) => p.name);
        if (blockingPresets.length > 0) {
            res.status(409).json({ error: 'addon_in_use', presets: blockingPresets });
            return;
        }
        const next = cfg.addons.filter((a) => a.name !== targetName);
        await this.persistAddons(next, req, `deleted addon "${targetName}"`);
        res.json({ ok: true });
    };

    private async persistAddons(
        next: AddonsEntity[],
        req: import('express').Request,
        summary: string,
    ): Promise<void> {
        const actor = (req as AuthedRequest).user;
        await this.configStore.setOverride('addons', next, actor?.id ?? '', summary);
        await this.reload();
    }
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

function validateAddon(
    raw: unknown,
): { ok: true; value: AddonsEntity } | { ok: false; issues: string[] } {
    const issues: string[] = [];
    if (typeof raw !== 'object' || raw === null) {
        return { ok: false, issues: ['body must be an addon object'] };
    }
    const e = raw as Record<string, unknown>;

    const name = typeof e.name === 'string' ? e.name.trim() : '';
    if (!name) issues.push('name is required');
    else if (name.length > MAX_NAME_LEN) issues.push(`name is too long (max ${MAX_NAME_LEN})`);
    else if (!ADDON_NAME_RE.test(name))
        issues.push('name may contain only letters, digits, spaces, _ and -');

    const github = typeof e.github === 'string' ? e.github.trim() : '';
    if (!github) issues.push('github is required');
    else if (!GITHUB_REPO_RE.test(github)) issues.push('github must be in "owner/repo" format');

    const ci = typeof e.ci === 'string' ? e.ci.trim() : '';
    if (!ci) issues.push('ci is required');
    else if (ci.length > 200) issues.push('ci is too long (max 200)');

    const description = typeof e.description === 'string' ? e.description : '';
    if (description.length > MAX_DESCRIPTION_LEN)
        issues.push(`description is too long (max ${MAX_DESCRIPTION_LEN})`);

    if (typeof e.gamemode !== 'boolean') issues.push('gamemode must be a boolean');

    let versions: Record<string, string> | undefined;
    if (e.versions !== undefined && e.versions !== null) {
        if (typeof e.versions !== 'object' || Array.isArray(e.versions)) {
            issues.push('versions must be an object mapping MC version to addon version');
        } else {
            const entries = Object.entries(e.versions as Record<string, unknown>);
            if (entries.length > MAX_VERSIONS_PER_ADDON) {
                issues.push(`versions has too many entries (max ${MAX_VERSIONS_PER_ADDON})`);
            }
            const out: Record<string, string> = {};
            for (const [k, v] of entries) {
                if (!MC_VERSION_RE.test(k)) {
                    issues.push(
                        `versions key "${k}" must be made of letters, digits, dots, dashes or underscores`,
                    );
                    continue;
                }
                if (typeof v !== 'string' || !v.trim()) {
                    issues.push(`versions["${k}"] must be a non-empty addon-version string`);
                    continue;
                }
                if (v.length > MAX_VERSION_VALUE_LEN) {
                    issues.push(
                        `versions["${k}"] is too long (max ${MAX_VERSION_VALUE_LEN})`,
                    );
                    continue;
                }
                out[k] = v;
            }
            if (Object.keys(out).length > 0) versions = out;
        }
    }

    if (issues.length) return { ok: false, issues };

    const value: AddonsEntity = {
        name,
        github: github as AddonsEntity['github'],
        ci,
        description,
        gamemode: e.gamemode as boolean,
    };
    if (versions) value.versions = versions;
    return { ok: true, value };
}
