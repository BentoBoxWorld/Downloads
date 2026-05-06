import { Request, RequestHandler, Response } from 'express';
import * as crypto from 'crypto';
import * as cron from 'node-cron';
import { BOOLEAN, Op, Sequelize } from 'sequelize';
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
    adminDiscordIds?: string[];
    blogAuthorDiscordIds?: string[];
    /** When set, session cookies are issued with Domain=<value> so a single
     *  Discord login covers download.* and blog.* under the same eTLD+1.
     *  Use ".bentobox.world" in production; leave undefined for localhost. */
    cookieDomain?: string;
}

const SESSION_COOKIE = 'bb_session';
const STATE_COOKIE = 'bb_oauth_state';
const RETURN_COOKIE = 'bb_oauth_return';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const STATE_TTL_MS = 10 * 60 * 1000;
const MAX_SESSIONS_PER_USER = 5;
const DEFAULT_POST_LOGIN_PATH = '/submit';

/** Same-origin relative path. Rejects schemes, protocol-relative `//host`,
 *  traversal, and anything that isn't a sane in-app path. */
function safeReturnPath(p: unknown): string | null {
    if (typeof p !== 'string') return null;
    if (p.length === 0 || p.length > 128) return null;
    if (!/^\/[A-Za-z0-9_\-./~]*$/.test(p)) return null;
    if (p.startsWith('//') || p.includes('..')) return null;
    return p;
}

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
        this.bootstrap(sequelize).catch((err) => console.error('[auth] bootstrap failed:', err));

        // Daily prune of expired sessions.
        cron.schedule('0 4 * * *', () => this.pruneExpiredSessions());
    }

    private async bootstrap(sequelize: Sequelize): Promise<void> {
        await this.users.sync();
        // Older Auth.sqlite databases predate these columns. Add them
        // idempotently — addColumn throws if it already exists, which we ignore.
        for (const col of ['isAdmin', 'canAuthorBlog']) {
            try {
                await sequelize.getQueryInterface().addColumn('users', col, {
                    type: BOOLEAN,
                    defaultValue: false,
                    allowNull: false,
                });
            } catch (e) {
                // Column already present.
            }
        }
        await this.sessions.sync();
        await this.submissions.sync();

        const adminIds = this.config?.adminDiscordIds ?? [];
        for (const id of adminIds) {
            await this.setAdmin(id, true);
        }
        const blogIds = this.config?.blogAuthorDiscordIds ?? [];
        for (const id of blogIds) {
            await this.setBlogAuthor(id, true);
        }
    }

    /** Idempotent. Granting creates a stub user row when the Discord ID has
     *  never logged in (so we can pre-grant). Revoking is a no-op when the
     *  user does not exist. */
    async setAdmin(discordId: string, isAdmin: boolean): Promise<void> {
        const existing = await this.users.findByPk(discordId);
        if (existing) {
            if (existing.isAdmin !== isAdmin) await existing.update({ isAdmin });
            return;
        }
        if (!isAdmin) return;
        const now = Date.now();
        await this.users.create({
            id: discordId,
            username: '',
            globalName: null,
            avatarHash: null,
            createdAt: now,
            lastLoginAt: 0,
            acceptedTermsVersion: null,
            isAdmin: true,
            canAuthorBlog: false,
        });
    }

    /** Idempotent. Same pre-grant behavior as setAdmin. */
    async setBlogAuthor(discordId: string, canAuthorBlog: boolean): Promise<void> {
        const existing = await this.users.findByPk(discordId);
        if (existing) {
            if (existing.canAuthorBlog !== canAuthorBlog) await existing.update({ canAuthorBlog });
            return;
        }
        if (!canAuthorBlog) return;
        const now = Date.now();
        await this.users.create({
            id: discordId,
            username: '',
            globalName: null,
            avatarHash: null,
            createdAt: now,
            lastLoginAt: 0,
            acceptedTermsVersion: null,
            isAdmin: false,
            canAuthorBlog: true,
        });
    }

    async listBlogAuthors(): Promise<
        Array<{
            id: string;
            username: string;
            globalName: string | null;
            avatarUrl: string | null;
            isAdmin: boolean;
        }>
    > {
        const rows = await this.users.findAll({
            where: { [Op.or]: [{ isAdmin: true }, { canAuthorBlog: true }] },
        });
        return rows.map((u) => ({
            id: u.id,
            username: u.username,
            globalName: u.globalName,
            avatarUrl: u.avatarHash
                ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatarHash}.png?size=64`
                : null,
            isAdmin: !!u.isAdmin,
        }));
    }

    async listAdmins(): Promise<
        Array<{
            id: string;
            username: string;
            globalName: string | null;
            avatarUrl: string | null;
            createdAt: number;
            lastLoginAt: number;
        }>
    > {
        const rows = await this.users.findAll({ where: { isAdmin: true } });
        return rows.map((u) => ({
            id: u.id,
            username: u.username,
            globalName: u.globalName,
            avatarUrl: u.avatarHash
                ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatarHash}.png?size=64`
                : null,
            createdAt: u.createdAt,
            lastLoginAt: u.lastLoginAt,
        }));
    }

    isConfigured(): boolean {
        return !!this.config && !!this.config.clientId && !!this.config.clientSecret;
    }

    // -------- OAuth flow --------

    handleLogin: RequestHandler = (req, res) => {
        if (!this.isConfigured() || !this.config) {
            res.status(503).send('Discord login is not configured on this server.');
            return;
        }
        const state = randomToken();
        const cookieDomain = this.config.cookieDomain;
        res.cookie(STATE_COOKIE, state, {
            httpOnly: true,
            secure: this.config.cookieSecure,
            sameSite: 'lax',
            maxAge: STATE_TTL_MS,
            path: '/',
            ...(cookieDomain ? { domain: cookieDomain } : {}),
        });
        const returnTo = safeReturnPath(req.query.return);
        if (returnTo) {
            res.cookie(RETURN_COOKIE, returnTo, {
                httpOnly: true,
                secure: this.config.cookieSecure,
                sameSite: 'lax',
                maxAge: STATE_TTL_MS,
                path: '/',
                ...(cookieDomain ? { domain: cookieDomain } : {}),
            });
        } else {
            // Stale cookie from a prior aborted flow could otherwise win.
            res.clearCookie(RETURN_COOKIE, { path: '/', ...(cookieDomain ? { domain: cookieDomain } : {}) });
        }
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
        const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
        const cookieState = cookies?.[STATE_COOKIE];
        if (!code || !state || !cookieState || !timingSafeEqualStr(state, cookieState)) {
            res.status(400).send('OAuth state mismatch. Please try again.');
            return;
        }
        const cookieDomain = this.config.cookieDomain;
        const domainOpt = cookieDomain ? { domain: cookieDomain } : {};
        res.clearCookie(STATE_COOKIE, { path: '/', ...domainOpt });
        const returnTo = safeReturnPath(cookies?.[RETURN_COOKIE]) ?? DEFAULT_POST_LOGIN_PATH;
        res.clearCookie(RETURN_COOKIE, { path: '/', ...domainOpt });

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
                isAdmin: false,
                canAuthorBlog: false,
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
            ...domainOpt,
        });
        res.redirect(returnTo);
    };

    handleLogout: RequestHandler = async (req, res) => {
        const session = (req as AuthedRequest).session;
        if (session) {
            await session.destroy();
        }
        const cookieDomain = this.config?.cookieDomain;
        res.clearCookie(SESSION_COOKIE, { path: '/', ...(cookieDomain ? { domain: cookieDomain } : {}) });
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
            isAdmin: !!user.isAdmin,
            canAuthorBlog: !!user.isAdmin || !!user.canAuthorBlog,
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
        const cookieDomain = this.config?.cookieDomain;
        res.clearCookie(SESSION_COOKIE, { path: '/', ...(cookieDomain ? { domain: cookieDomain } : {}) });
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

    requireAdmin: RequestHandler = async (req, res, next) => {
        const session = (req as AuthedRequest).session;
        if (!session) {
            res.status(401).json({ error: 'unauthenticated' });
            return;
        }
        const user = await this.users.findByPk(session.userId);
        if (!user || !user.isAdmin) {
            res.status(403).json({ error: 'forbidden' });
            return;
        }
        next();
    };

    /** Admins always count as blog authors. */
    requireBlogAuthor: RequestHandler = async (req, res, next) => {
        const session = (req as AuthedRequest).session;
        if (!session) {
            res.status(401).json({ error: 'unauthenticated' });
            return;
        }
        const user = await this.users.findByPk(session.userId);
        if (!user || (!user.isAdmin && !user.canAuthorBlog)) {
            res.status(403).json({ error: 'forbidden' });
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
