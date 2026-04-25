import { Request, RequestHandler, Response } from 'express';
import * as crypto from 'crypto';
import * as cron from 'node-cron';
import { Op, Sequelize } from 'sequelize';
import axios from 'axios';
import {
    SessionFactory,
    SessionModel,
    SessionStatic,
    SubmissionFactory,
    SubmissionStatic,
    UserFactory,
    UserStatic,
} from './models/auth';

export interface AuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    cookieSecure: boolean; // true in prod, false on localhost dev
}

const SESSION_COOKIE = 'bb_session';
const STATE_COOKIE = 'bb_oauth_state';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const STATE_TTL_MS = 10 * 60 * 1000;
const MAX_SESSIONS_PER_USER = 5;

export const TERMS_VERSION = '2026-04-24';

export interface AuthedRequest extends Request {
    session?: SessionModel;
    user?: { id: string; username: string };
}

export class AuthManager {
    private readonly users: UserStatic;
    private readonly sessions: SessionStatic;
    readonly submissions: SubmissionStatic;

    constructor(private readonly config: AuthConfig | null, sequelize: Sequelize) {
        this.users = UserFactory(sequelize);
        this.sessions = SessionFactory(sequelize);
        this.submissions = SubmissionFactory(sequelize);
        this.users.sync();
        this.sessions.sync();
        this.submissions.sync();

        // Daily prune of expired sessions.
        cron.schedule('0 4 * * *', () => this.pruneExpiredSessions());
    }

    isConfigured(): boolean {
        return !!this.config && !!this.config.clientId && !!this.config.clientSecret;
    }

    // -------- OAuth flow --------

    handleLogin: RequestHandler = (_req, res) => {
        if (!this.isConfigured() || !this.config) {
            res.status(503).send('Discord login is not configured on this server.');
            return;
        }
        const state = randomToken();
        res.cookie(STATE_COOKIE, state, {
            httpOnly: true,
            secure: this.config.cookieSecure,
            sameSite: 'lax',
            maxAge: STATE_TTL_MS,
            path: '/',
        });
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            response_type: 'code',
            scope: 'identify',
            redirect_uri: this.config.redirectUri,
            state,
            prompt: 'none',
        });
        res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
    };

    handleCallback: RequestHandler = async (req, res) => {
        if (!this.isConfigured() || !this.config) {
            res.status(503).send('Discord login is not configured on this server.');
            return;
        }
        const code = typeof req.query.code === 'string' ? req.query.code : '';
        const state = typeof req.query.state === 'string' ? req.query.state : '';
        const cookieState = (req as Request & { cookies?: Record<string, string> }).cookies?.[STATE_COOKIE];
        if (!code || !state || !cookieState || !timingSafeEqualStr(state, cookieState)) {
            res.status(400).send('OAuth state mismatch. Please try again.');
            return;
        }
        res.clearCookie(STATE_COOKIE, { path: '/' });

        let identity: { id: string; username: string; global_name: string | null; avatar: string | null };
        try {
            const tokenResp = await axios.post(
                'https://discord.com/api/oauth2/token',
                new URLSearchParams({
                    client_id: this.config.clientId,
                    client_secret: this.config.clientSecret,
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: this.config.redirectUri,
                }).toString(),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
            );
            const accessToken = tokenResp.data.access_token as string;
            // Fetch identity, then forget the token. We never persist it.
            const me = await axios.get('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            identity = me.data;
        } catch (err) {
            // Deliberately do not log err.config or err.response.data — token may be in there.
            console.error('[auth] Discord token exchange failed');
            res.status(502).send('Could not complete Discord login. Please try again.');
            return;
        }

        const now = Date.now();
        const existing = await this.users.findByPk(identity.id);
        if (existing) {
            await existing.update({
                username: identity.username,
                globalName: identity.global_name,
                avatarHash: identity.avatar,
                lastLoginAt: now,
            });
        } else {
            await this.users.create({
                id: identity.id,
                username: identity.username,
                globalName: identity.global_name,
                avatarHash: identity.avatar,
                createdAt: now,
                lastLoginAt: now,
                acceptedTermsVersion: null,
            });
        }

        // Cap concurrent sessions per user — evict oldest.
        const userSessions = await this.sessions.findAll({
            where: { userId: identity.id },
            order: [['createdAt', 'ASC']],
        });
        const overflow = userSessions.length - (MAX_SESSIONS_PER_USER - 1);
        for (let i = 0; i < overflow; i++) {
            await userSessions[i].destroy();
        }

        const sessionId = randomToken();
        const csrfToken = randomToken();
        await this.sessions.create({
            sessionId,
            userId: identity.id,
            csrfToken,
            createdAt: now,
            lastSeenAt: now,
            expiresAt: now + SESSION_TTL_MS,
        });
        res.cookie(SESSION_COOKIE, sessionId, {
            httpOnly: true,
            secure: this.config.cookieSecure,
            sameSite: 'lax',
            maxAge: SESSION_TTL_MS,
            path: '/',
        });
        res.redirect('/submit');
    };

    handleLogout: RequestHandler = async (req, res) => {
        const session = (req as AuthedRequest).session;
        if (session) {
            await session.destroy();
        }
        res.clearCookie(SESSION_COOKIE, { path: '/' });
        res.json({ ok: true });
    };

    handleMe: RequestHandler = async (req, res) => {
        const session = (req as AuthedRequest).session;
        if (!session) {
            res.status(401).json({ error: 'unauthenticated' });
            return;
        }
        const user = await this.users.findByPk(session.userId);
        if (!user) {
            res.status(401).json({ error: 'unauthenticated' });
            return;
        }
        res.json({
            id: user.id,
            username: user.username,
            globalName: user.globalName,
            avatarUrl: user.avatarHash
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatarHash}.png?size=128`
                : null,
            acceptedTermsVersion: user.acceptedTermsVersion,
            csrfToken: session.csrfToken,
            currentTermsVersion: TERMS_VERSION,
        });
    };

    handleDeleteMe: RequestHandler = async (req, res) => {
        const session = (req as AuthedRequest).session;
        if (!session) {
            res.status(401).json({ error: 'unauthenticated' });
            return;
        }
        const userId = session.userId;
        await this.sessions.destroy({ where: { userId } });
        await this.users.destroy({ where: { id: userId } });
        res.clearCookie(SESSION_COOKIE, { path: '/' });
        res.json({ ok: true });
    };

    // -------- Session middleware --------

    loadSession: RequestHandler = async (req, _res, next) => {
        const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
        const sid = cookies?.[SESSION_COOKIE];
        if (!sid) return next();
        const session = await this.sessions.findByPk(sid);
        if (!session) return next();
        if (session.expiresAt < Date.now()) {
            await session.destroy();
            return next();
        }
        if (Date.now() - session.lastSeenAt > 60_000) {
            session.lastSeenAt = Date.now();
            await session.save();
        }
        (req as AuthedRequest).session = session;
        (req as AuthedRequest).user = { id: session.userId, username: '' };
        next();
    };

    requireSession: RequestHandler = (req, res, next) => {
        if (!(req as AuthedRequest).session) {
            res.status(401).json({ error: 'unauthenticated' });
            return;
        }
        next();
    };

    requireCsrf: RequestHandler = (req, res, next) => {
        const session = (req as AuthedRequest).session;
        if (!session) {
            res.status(401).json({ error: 'unauthenticated' });
            return;
        }
        const provided = req.header('x-csrf-token');
        if (!provided || !timingSafeEqualStr(provided, session.csrfToken)) {
            res.status(403).json({ error: 'csrf' });
            return;
        }
        next();
    };

    // -------- Rate limiting --------
    //
    // Sliding-window in-memory limiter keyed by IP for the OAuth callback,
    // and by Discord user-id for submissions. Map entries are pruned lazily
    // on read, so memory stays bounded by active actors.

    private callbackHits = new Map<string, number[]>();
    private static CALLBACK_WINDOW_MS = 60_000;
    private static CALLBACK_LIMIT = 30;

    callbackRateLimit: RequestHandler = (req, res, next) => {
        const ip = (req.ip || req.socket.remoteAddress || 'unknown').toString();
        const now = Date.now();
        const window = this.callbackHits.get(ip)?.filter((t) => now - t < AuthManager.CALLBACK_WINDOW_MS) ?? [];
        if (window.length >= AuthManager.CALLBACK_LIMIT) {
            res.status(429).send('Too many auth callbacks; slow down.');
            return;
        }
        window.push(now);
        this.callbackHits.set(ip, window);
        next();
    };

    private submissionHits = new Map<string, number[]>();
    private static SUBMISSION_HOUR_MS = 60 * 60 * 1000;
    private static SUBMISSION_DAY_MS = 24 * 60 * 60 * 1000;
    private static SUBMISSION_PER_HOUR = 3;
    private static SUBMISSION_PER_DAY = 10;

    consumeSubmissionQuota(userId: string): { ok: true } | { ok: false; reason: string } {
        const now = Date.now();
        const hits = (this.submissionHits.get(userId) ?? []).filter(
            (t) => now - t < AuthManager.SUBMISSION_DAY_MS,
        );
        const inHour = hits.filter((t) => now - t < AuthManager.SUBMISSION_HOUR_MS).length;
        if (inHour >= AuthManager.SUBMISSION_PER_HOUR) {
            return { ok: false, reason: 'hourly submission limit reached' };
        }
        if (hits.length >= AuthManager.SUBMISSION_PER_DAY) {
            return { ok: false, reason: 'daily submission limit reached' };
        }
        hits.push(now);
        this.submissionHits.set(userId, hits);
        return { ok: true };
    }

    // -------- Helpers used by submissions --------

    async recordTermsAccepted(userId: string, version: string): Promise<void> {
        await this.users.update({ acceptedTermsVersion: version }, { where: { id: userId } });
    }

    async findUser(userId: string) {
        return this.users.findByPk(userId);
    }

    private async pruneExpiredSessions(): Promise<void> {
        try {
            const removed = await this.sessions.destroy({
                where: { expiresAt: { [Op.lt]: Date.now() } },
            });
            if (removed > 0) console.log(`[auth] pruned ${removed} expired sessions`);
        } catch (err) {
            console.error('[auth] session prune failed:', (err as Error).message);
        }
    }
}

// -------- Module helpers --------

function randomToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

function timingSafeEqualStr(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
