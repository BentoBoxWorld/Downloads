import { RequestHandler } from 'express';
import { AuthedRequest, AuthManager } from './auth';

const DISCORD_ID_RE = /^[0-9]{15,25}$/;

export class AdminManager {
    constructor(private readonly auth: AuthManager) {}

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
}
