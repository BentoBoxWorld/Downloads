import { RequestHandler } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as cron from 'node-cron';
import { Op, Sequelize } from 'sequelize';
import axios from 'axios';
import multer = require('multer');
import MarkdownIt = require('markdown-it');
import hljs from 'highlight.js';
import slugify = require('slugify');
import { AuthedRequest, AuthManager } from './auth';
import {
    PostFactory,
    PostModel,
    PostRevisionFactory,
    PostRevisionStatic,
    PostStatic,
} from './models/blog';

const MAX_TITLE = 200;
const MAX_SUMMARY = 400;
const MAX_BODY = 200_000;
const MAX_SLUG = 80;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const POSTS_PER_PAGE = 10;
const TAG_RE = /^[a-z0-9][a-z0-9-]{0,29}$/;
const MAX_TAGS_PER_POST = 6;

// 5 MB cap on uploaded images.
const MAX_IMAGE = 5 * 1024 * 1024;

export const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE, files: 1 },
});

export interface BlogConfig {
    /** Public origin for the blog (used in RSS + OG canonical URLs).
     *  e.g. "https://blog.bentobox.world". When unset, falls back to relative URLs. */
    baseUrl?: string;
    /** Discord webhook to ping when a post transitions to published. */
    discordWebhookPath?: string;
    /** Where uploaded images are written. */
    imageDir: string;
    /** Optional Giscus config; when set, comments render on each post page. */
    giscus?: GiscusConfig;
}

export interface GiscusConfig {
    repo: string;          // "owner/name"
    repoId: string;        // R_kgDO… from giscus.app
    category: string;      // discussion category name
    categoryId: string;    // DIC_kwDO… from giscus.app
    mapping?: string;      // "pathname" (default), "url", "title", …
    theme?: string;        // "light" (default), "preferred_color_scheme", …
}

interface PublicPost {
    id: number;
    slug: string;
    title: string;
    summary: string;
    bodyHtml: string;
    coverImage: string | null;
    author: { id: string; name: string; avatarUrl: string | null };
    publishedAt: number;
    updatedAt: number;
    edited: boolean;
    tags: string[];
}

interface AdminPost extends PublicPost {
    bodyMd: string;
    status: string;
    createdAt: number;
    viewCount: number;
}

export class BlogManager {
    private readonly posts: PostStatic;
    private readonly revisions: PostRevisionStatic;
    private readonly md: MarkdownIt;
    private readonly cfg: BlogConfig;

    constructor(
        private readonly auth: AuthManager,
        sequelize: Sequelize,
        cfg: BlogConfig,
    ) {
        this.cfg = cfg;
        this.posts = PostFactory(sequelize);
        this.revisions = PostRevisionFactory(sequelize);
        this.md = new MarkdownIt({
            html: false,         // raw HTML in source is silently dropped
            linkify: true,
            breaks: false,
            typographer: true,
            highlight: (str: string, lang: string): string => {
                // Server-side syntax highlighting via highlight.js. Returns a
                // full <pre><code> wrapper (markdown-it skips its default
                // wrapping when the return string starts with `<pre`), with
                // both `hljs` and `language-X` classes for our CSS rules.
                const safe = lang && hljs.getLanguage(lang) ? lang : '';
                let body: string;
                let language = safe;
                try {
                    if (safe) {
                        body = hljs.highlight(str, { language: safe, ignoreIllegals: true }).value;
                    } else {
                        const auto = hljs.highlightAuto(str);
                        body = auto.value;
                        language = auto.language || '';
                    }
                } catch {
                    return '';
                }
                const classes = `hljs${language ? ` language-${language}` : ''}`;
                return `<pre><code class="${classes}">${body}</code></pre>`;
            },
        });

        this.bootstrap(sequelize).catch((err) => console.error('[blog] bootstrap failed:', err));
        try {
            fs.mkdirSync(this.cfg.imageDir, { recursive: true });
        } catch {
            /* ignore */
        }

        // Daily prune of orphaned revisions older than 90 days.
        cron.schedule('30 4 * * *', () => this.pruneOldRevisions());
        // Per-minute promotion of scheduled posts.
        cron.schedule('* * * * *', () => this.promoteScheduledPosts());
    }

    private async bootstrap(sequelize: Sequelize): Promise<void> {
        await this.posts.sync();
        await this.revisions.sync();
        // Idempotent migration: add tagsJson to existing databases.
        try {
            await sequelize.getQueryInterface().addColumn('posts', 'tagsJson', {
                type: 'TEXT',
                allowNull: false,
                defaultValue: '[]',
            } as never);
        } catch {
            /* column already present */
        }
    }

    // -------- Public API --------

    /** GET /api/blog/posts?page=N&tag=X&q=foo */
    handleListPosts: RequestHandler = async (req, res) => {
        const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
        const offset = (page - 1) * POSTS_PER_PAGE;
        const tagFilter = typeof req.query.tag === 'string' ? normalizeTag(req.query.tag) : '';
        const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';

        // No JSON_ARRAY operators in stock SQLite/Sequelize without the JSON1
        // ext, so for tag filtering we read+filter in JS. Total count is the
        // post universe; small-N blog so this is fine.
        const all = await this.posts.findAll({
            where: { status: 'published' },
            order: [['publishedAt', 'DESC']],
        });
        let filtered = tagFilter
            ? all.filter((p) => parseTags(p.tagsJson).includes(tagFilter))
            : all;
        if (q) {
            const needle = q.toLowerCase();
            filtered = filtered.filter((p) => {
                if (p.title.toLowerCase().includes(needle)) return true;
                if (p.summary.toLowerCase().includes(needle)) return true;
                if (p.bodyMd.toLowerCase().includes(needle)) return true;
                return false;
            });
        }
        const slice = filtered.slice(offset, offset + POSTS_PER_PAGE);
        const summaries = await Promise.all(slice.map((p) => this.toPublicSummary(p)));
        res.json({
            posts: summaries,
            page,
            pageSize: POSTS_PER_PAGE,
            total: filtered.length,
            hasMore: offset + slice.length < filtered.length,
            tag: tagFilter || null,
            query: q || null,
        });
    };

    /** GET /api/blog/comments-config — public Giscus config (or null). */
    handleCommentsConfig: RequestHandler = (_req, res) => {
        if (!this.cfg.giscus) {
            res.json(null);
            return;
        }
        const g = this.cfg.giscus;
        res.json({
            repo: g.repo,
            repoId: g.repoId,
            category: g.category,
            categoryId: g.categoryId,
            mapping: g.mapping || 'pathname',
            theme: g.theme || 'light',
        });
    };

    /** GET /api/blog/tags — aggregate counts across published posts. */
    handleListTags: RequestHandler = async (_req, res) => {
        const all = await this.posts.findAll({ where: { status: 'published' } });
        const counts = new Map<string, number>();
        for (const p of all) {
            for (const t of parseTags(p.tagsJson)) {
                counts.set(t, (counts.get(t) ?? 0) + 1);
            }
        }
        const out = Array.from(counts.entries())
            .map(([slug, count]) => ({ slug, count }))
            .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
        res.json(out);
    };

    /** GET /api/blog/posts/:slug */
    handleGetPost: RequestHandler = async (req, res) => {
        const slug = String((req.params as Record<string, string>).slug ?? '');
        const post = await this.posts.findOne({ where: { slug, status: 'published' } });
        if (!post) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        // Best-effort view counter, fire-and-forget.
        post.update({ viewCount: post.viewCount + 1 }).catch(() => undefined);
        res.json(await this.toPublicPost(post));
    };

    /** GET /api/blog/feed.xml — RSS 2.0 */
    handleRss: RequestHandler = async (_req, res) => {
        const rows = await this.posts.findAll({
            where: { status: 'published' },
            order: [['publishedAt', 'DESC']],
            limit: 30,
        });
        const base = (this.cfg.baseUrl || '').replace(/\/$/, '');
        const escapeXml = (s: string): string =>
            s
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        const items = await Promise.all(
            rows.map(async (p) => {
                const link = `${base}/p/${encodeURIComponent(p.slug)}`;
                const author = await this.auth.findUser(p.authorId);
                const authorName = author?.globalName || author?.username || 'BentoBox';
                return [
                    '    <item>',
                    `      <title>${escapeXml(p.title)}</title>`,
                    `      <link>${escapeXml(link)}</link>`,
                    `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
                    `      <pubDate>${new Date(p.publishedAt ?? p.createdAt).toUTCString()}</pubDate>`,
                    `      <dc:creator>${escapeXml(authorName)}</dc:creator>`,
                    `      <description>${escapeXml(p.summary || stripTags(p.bodyHtml).slice(0, 280))}</description>`,
                    `      <content:encoded><![CDATA[${p.bodyHtml}]]></content:encoded>`,
                    '    </item>',
                ].join('\n');
            }),
        );
        const xml = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">',
            '  <channel>',
            '    <title>BentoBox Blog</title>',
            `    <link>${escapeXml(base || 'https://blog.bentobox.world')}</link>`,
            '    <description>Releases, API changes, and notes from the BentoBox developers.</description>',
            '    <language>en</language>',
            `    <atom:link href="${escapeXml(base + '/feed.xml')}" rel="self" type="application/rss+xml" />`,
            ...items,
            '  </channel>',
            '</rss>',
        ].join('\n');
        res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.send(xml);
    };

    /** GET /blog/sitemap.xml — list of public URLs for crawlers. */
    handleSitemap: RequestHandler = async (_req, res) => {
        const rows = await this.posts.findAll({
            where: { status: 'published' },
            order: [['publishedAt', 'DESC']],
        });
        const base = (this.cfg.baseUrl || '').replace(/\/$/, '') || 'https://blog.bentobox.world';
        const urls = [
            `  <url><loc>${base}/</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`,
            ...rows.map(
                (p) =>
                    `  <url><loc>${base}/p/${encodeURIComponent(p.slug)}</loc><lastmod>${new Date(
                        p.updatedAt,
                    ).toISOString()}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`,
            ),
        ];
        const xml = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            ...urls,
            '</urlset>',
        ].join('\n');
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=600');
        res.send(xml);
    };

    /** GET /blog/p/:slug — server-rendered HTML with OG tags. */
    async renderPostPage(slug: string, spaTemplate: string): Promise<string | null> {
        const post = await this.posts.findOne({ where: { slug, status: 'published' } });
        if (!post) return null;
        const author = await this.auth.findUser(post.authorId);
        const authorName = author?.globalName || author?.username || 'BentoBox';
        const base = (this.cfg.baseUrl || '').replace(/\/$/, '');
        const canonical = `${base}/p/${encodeURIComponent(post.slug)}`;
        const title = escapeAttr(post.title);
        const desc = escapeAttr(post.summary || stripTags(post.bodyHtml).slice(0, 280));
        const cover = post.coverImage
            ? (post.coverImage.startsWith('http') ? post.coverImage : base + post.coverImage)
            : '';
        const ogImage = cover ? `<meta property="og:image" content="${escapeAttr(cover)}" />` : '';
        const twImage = cover ? `<meta name="twitter:image" content="${escapeAttr(cover)}" />` : '';
        const jsonLd = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: post.title,
            description: post.summary,
            image: cover || undefined,
            author: { '@type': 'Person', name: authorName },
            datePublished: new Date(post.publishedAt ?? post.createdAt).toISOString(),
            dateModified: new Date(post.updatedAt).toISOString(),
            mainEntityOfPage: canonical,
        });
        const tags = [
            `    <title>${title} — BentoBox Blog</title>`,
            `    <meta name="description" content="${desc}" />`,
            `    <link rel="stylesheet" href="/blog/highlight.css" />`,
            `    <link rel="canonical" href="${escapeAttr(canonical)}" />`,
            `    <meta property="og:type" content="article" />`,
            `    <meta property="og:title" content="${title}" />`,
            `    <meta property="og:description" content="${desc}" />`,
            `    <meta property="og:url" content="${escapeAttr(canonical)}" />`,
            `    <meta property="og:site_name" content="BentoBox Blog" />`,
            `    <meta property="article:author" content="${escapeAttr(authorName)}" />`,
            `    <meta property="article:published_time" content="${new Date(post.publishedAt ?? post.createdAt).toISOString()}" />`,
            ogImage,
            `    <meta name="twitter:card" content="${cover ? 'summary_large_image' : 'summary'}" />`,
            `    <meta name="twitter:title" content="${title}" />`,
            `    <meta name="twitter:description" content="${desc}" />`,
            twImage,
            `    <script type="application/ld+json">${jsonLd.replace(/</g, '\\u003c')}</script>`,
        ]
            .filter(Boolean)
            .join('\n');
        // Inject tags right before </head>. The SPA template's existing
        // <title> stays — search engines ignore it once they see ours below.
        return spaTemplate.replace('</head>', `${tags}\n</head>`);
    }

    // -------- Admin API (gated by requireBlogAuthor in index.ts) --------

    /** GET /api/blog/admin/posts */
    handleListAdminPosts: RequestHandler = async (_req, res) => {
        const rows = await this.posts.findAll({ order: [['updatedAt', 'DESC']], limit: 200 });
        const out = await Promise.all(rows.map((p) => this.toAdminSummary(p)));
        res.json(out);
    };

    /** GET /api/blog/admin/posts/:id */
    handleGetAdminPost: RequestHandler = async (req, res) => {
        const id = parseInt(String((req.params as Record<string, string>).id ?? ''), 10);
        if (!Number.isFinite(id)) {
            res.status(400).json({ error: 'invalid_id' });
            return;
        }
        const post = await this.posts.findByPk(id);
        if (!post) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        res.json(await this.toAdminPost(post));
    };

    /** POST /api/blog/admin/posts */
    handleCreatePost: RequestHandler = async (req, res) => {
        const ar = req as AuthedRequest;
        if (!ar.user) {
            res.status(401).json({ error: 'unauthenticated' });
            return;
        }
        const body = (req.body ?? {}) as Record<string, unknown>;
        const title = sanitizeShortString(body.title, MAX_TITLE);
        if (!title) {
            res.status(400).json({ error: 'missing_title' });
            return;
        }
        const desiredSlug = typeof body.slug === 'string' && body.slug.trim()
            ? normalizeSlug(body.slug)
            : await this.uniqueSlugFromTitle(title);
        if (!SLUG_RE.test(desiredSlug)) {
            res.status(400).json({ error: 'bad_slug' });
            return;
        }
        if (await this.posts.findOne({ where: { slug: desiredSlug } })) {
            res.status(409).json({ error: 'slug_taken' });
            return;
        }
        const now = Date.now();
        const post = await this.posts.create({
            slug: desiredSlug,
            title,
            summary: sanitizeShortString(body.summary, MAX_SUMMARY) ?? '',
            bodyMd: sanitizeBody(body.bodyMd) ?? '',
            bodyHtml: '',
            coverImage: sanitizeImagePath(body.coverImage),
            authorId: ar.user.id,
            status: 'draft',
            publishedAt: null,
            createdAt: now,
            updatedAt: now,
            viewCount: 0,
            tagsJson: JSON.stringify(sanitizeTagInput(body.tags)),
        } as never);
        post.bodyHtml = this.renderMarkdown(post.bodyMd);
        await post.save();
        res.json(await this.toAdminPost(post));
    };

    /** PUT /api/blog/admin/posts/:id */
    handleUpdatePost: RequestHandler = async (req, res) => {
        const ar = req as AuthedRequest;
        if (!ar.user) {
            res.status(401).json({ error: 'unauthenticated' });
            return;
        }
        const id = parseInt(String((req.params as Record<string, string>).id ?? ''), 10);
        if (!Number.isFinite(id)) {
            res.status(400).json({ error: 'invalid_id' });
            return;
        }
        const post = await this.posts.findByPk(id);
        if (!post) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        const body = (req.body ?? {}) as Record<string, unknown>;
        const title = sanitizeShortString(body.title, MAX_TITLE);
        if (!title) {
            res.status(400).json({ error: 'missing_title' });
            return;
        }

        // Slug rename: validate uniqueness if changed.
        let nextSlug = post.slug;
        if (typeof body.slug === 'string' && body.slug.trim()) {
            const candidate = normalizeSlug(body.slug);
            if (!SLUG_RE.test(candidate)) {
                res.status(400).json({ error: 'bad_slug' });
                return;
            }
            if (candidate !== post.slug) {
                if (await this.posts.findOne({ where: { slug: candidate, id: { [Op.ne]: post.id } } })) {
                    res.status(409).json({ error: 'slug_taken' });
                    return;
                }
                nextSlug = candidate;
            }
        }

        // Snapshot previous markdown to revisions before overwriting.
        await this.revisions.create({
            postId: post.id,
            title: post.title,
            summary: post.summary,
            bodyMd: post.bodyMd,
            editorId: ar.user.id,
            createdAt: Date.now(),
        } as never);

        const bodyMd = sanitizeBody(body.bodyMd) ?? '';
        const summary = sanitizeShortString(body.summary, MAX_SUMMARY) ?? '';
        const coverImage = sanitizeImagePath(body.coverImage);
        await post.update({
            title,
            slug: nextSlug,
            summary,
            bodyMd,
            bodyHtml: this.renderMarkdown(bodyMd),
            coverImage,
            updatedAt: Date.now(),
            tagsJson:
                body.tags !== undefined
                    ? JSON.stringify(sanitizeTagInput(body.tags))
                    : post.tagsJson,
        });
        res.json(await this.toAdminPost(post));
    };

    /** POST /api/blog/admin/posts/:id/publish
     *  Body: { at?: number } — when set to a future ms-epoch, schedules the
     *  post; otherwise publishes immediately. */
    handlePublishPost: RequestHandler = async (req, res) => {
        const id = parseInt(String((req.params as Record<string, string>).id ?? ''), 10);
        if (!Number.isFinite(id)) {
            res.status(400).json({ error: 'invalid_id' });
            return;
        }
        const post = await this.posts.findByPk(id);
        if (!post) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        const body = (req.body ?? {}) as { at?: unknown };
        const at = typeof body.at === 'number' && Number.isFinite(body.at) ? body.at : null;
        const now = Date.now();
        const wasPublished = post.status === 'published';

        if (at !== null && at > now + 60_000) {
            // Schedule for the future.
            await post.update({
                status: 'scheduled',
                publishedAt: at,
                updatedAt: now,
            });
        } else {
            await post.update({
                status: 'published',
                publishedAt: post.publishedAt && post.status === 'published' ? post.publishedAt : now,
                updatedAt: now,
            });
            if (!wasPublished) {
                this.notifyDiscord(post).catch((err) =>
                    console.error('[blog] discord webhook failed:', (err as Error)?.message ?? err),
                );
            }
        }
        res.json(await this.toAdminPost(post));
    };

    /** POST /api/blog/admin/posts/:id/unpublish */
    handleUnpublishPost: RequestHandler = async (req, res) => {
        const id = parseInt(String((req.params as Record<string, string>).id ?? ''), 10);
        if (!Number.isFinite(id)) {
            res.status(400).json({ error: 'invalid_id' });
            return;
        }
        const post = await this.posts.findByPk(id);
        if (!post) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        await post.update({ status: 'draft', updatedAt: Date.now() });
        res.json(await this.toAdminPost(post));
    };

    /** DELETE /api/blog/admin/posts/:id */
    handleDeletePost: RequestHandler = async (req, res) => {
        const id = parseInt(String((req.params as Record<string, string>).id ?? ''), 10);
        if (!Number.isFinite(id)) {
            res.status(400).json({ error: 'invalid_id' });
            return;
        }
        const post = await this.posts.findByPk(id);
        if (!post) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        await this.revisions.destroy({ where: { postId: post.id } });
        await post.destroy();
        res.json({ ok: true });
    };

    /** POST /api/blog/admin/images — multipart with field 'image'. */
    handleUploadImage: RequestHandler = async (req, res) => {
        type WithFile = typeof req & { file?: Express.Multer.File };
        const r = req as WithFile;
        if (!r.file) {
            res.status(400).json({ error: 'no_file' });
            return;
        }
        const mime = r.file.mimetype;
        const ext = imageExtFor(mime);
        if (!ext) {
            res.status(400).json({ error: 'bad_type', reason: `${mime} not allowed` });
            return;
        }
        const now = new Date();
        const subdir = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
        const dir = path.join(this.cfg.imageDir, subdir);
        try {
            fs.mkdirSync(dir, { recursive: true });
        } catch {
            /* ignore */
        }
        const hash = crypto.createHash('sha256').update(r.file.buffer).digest('hex').slice(0, 16);
        const filename = `${hash}.${ext}`;
        const target = path.join(dir, filename);
        if (!fs.existsSync(target)) {
            fs.writeFileSync(target, r.file.buffer);
        }
        const url = `/blog/images/${subdir}/${filename}`;
        res.json({ url });
    };

    // -------- Helpers --------

    private renderMarkdown(md: string): string {
        // markdown-it is configured with html:false (raw HTML in source is
        // escaped) and uses its default link validator which rejects unsafe
        // schemes like javascript: and vbscript:. The output is therefore
        // already safe to serve — no further sanitization is needed.
        // Post-processing: rewrite external <a> tags to open in a new tab,
        // mark images for lazy loading, and convert GFM-style alert
        // blockquotes (`> [!NOTE]\n> body`) into styled callout boxes.
        const raw = this.md.render(md ?? '');
        return processCallouts(raw)
            .replace(/<a\s+href="(https?:\/\/[^"]+)"/g, (_m, href: string) => {
                return `<a href="${href}" target="_blank" rel="nofollow noopener noreferrer"`;
            })
            .replace(/<img\s+/g, '<img loading="lazy" ');
    }

    private async uniqueSlugFromTitle(title: string): Promise<string> {
        const base = normalizeSlug(slugify(title, { lower: true, strict: true })) || 'post';
        let candidate = base;
        let n = 2;
        // Loop bound: we don't expect collisions to exceed a handful.
        // SLUG_RE caps length at 80, so suffix grows are minor.
        for (let i = 0; i < 100; i++) {
            const existing = await this.posts.findOne({ where: { slug: candidate } });
            if (!existing) return candidate;
            candidate = `${base}-${n++}`.slice(0, MAX_SLUG);
        }
        return `${base}-${Date.now()}`.slice(0, MAX_SLUG);
    }

    private async toPublicSummary(p: PostModel): Promise<PublicPost> {
        return this.toPublicPost(p, /*includeBody=*/ false);
    }

    private async toPublicPost(p: PostModel, includeBody = true): Promise<PublicPost> {
        const author = await this.auth.findUser(p.authorId);
        return {
            id: p.id,
            slug: p.slug,
            title: p.title,
            summary: p.summary,
            bodyHtml: includeBody ? p.bodyHtml : '',
            coverImage: p.coverImage,
            author: {
                id: p.authorId,
                name: author?.globalName || author?.username || 'BentoBox',
                avatarUrl: author?.avatarHash
                    ? `https://cdn.discordapp.com/avatars/${p.authorId}/${author.avatarHash}.png?size=64`
                    : null,
            },
            publishedAt: p.publishedAt ?? p.createdAt,
            updatedAt: p.updatedAt,
            edited:
                p.publishedAt !== null && p.updatedAt - p.publishedAt > 60 * 60 * 1000,
            tags: parseTags(p.tagsJson),
        };
    }

    private async toAdminSummary(p: PostModel): Promise<AdminPost> {
        return this.toAdminPost(p);
    }

    private async toAdminPost(p: PostModel): Promise<AdminPost> {
        const pub = await this.toPublicPost(p);
        return {
            ...pub,
            bodyMd: p.bodyMd,
            status: p.status,
            createdAt: p.createdAt,
            viewCount: p.viewCount,
        };
    }

    private async notifyDiscord(post: PostModel): Promise<void> {
        const url = this.cfg.discordWebhookPath;
        if (!url) return;
        const author = await this.auth.findUser(post.authorId);
        const authorName = author?.globalName || author?.username || 'BentoBox';
        const base = (this.cfg.baseUrl || '').replace(/\/$/, '');
        const link = base ? `${base}/p/${encodeURIComponent(post.slug)}` : `/p/${encodeURIComponent(post.slug)}`;
        const payload = {
            embeds: [
                {
                    title: post.title,
                    description: (post.summary || stripTags(post.bodyHtml).slice(0, 280)) || ' ',
                    url: link,
                    color: 0x4ea96a,
                    author: { name: authorName },
                    timestamp: new Date(post.publishedAt ?? Date.now()).toISOString(),
                    footer: { text: 'BentoBox Blog' },
                },
            ],
        };
        // url may be either a full URL or a path; coerce to full URL.
        const fullUrl = url.startsWith('http') ? url : `https://discord.com${url}`;
        await axios.post(fullUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000,
        });
    }

    private async promoteScheduledPosts(): Promise<void> {
        try {
            const due = await this.posts.findAll({
                where: { status: 'scheduled', publishedAt: { [Op.lte]: Date.now() } },
            });
            for (const post of due) {
                await post.update({ status: 'published', updatedAt: Date.now() });
                this.notifyDiscord(post).catch((err) =>
                    console.error(
                        '[blog] discord webhook failed (promote):',
                        (err as Error)?.message ?? err,
                    ),
                );
            }
        } catch (err) {
            console.error('[blog] schedule promote failed:', (err as Error).message);
        }
    }

    private async pruneOldRevisions(): Promise<void> {
        const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
        try {
            const removed = await this.revisions.destroy({ where: { createdAt: { [Op.lt]: cutoff } } });
            if (removed > 0) console.log(`[blog] pruned ${removed} stale revisions`);
        } catch (err) {
            console.error('[blog] revision prune failed:', (err as Error).message);
        }
    }
}

// ---------- Helpers ----------

function sanitizeShortString(v: unknown, max: number): string | undefined {
    if (typeof v !== 'string') return undefined;
    const s = v.trim();
    if (!s) return '';
    if (s.length > max) return s.slice(0, max);
    return s;
}

function sanitizeBody(v: unknown): string | undefined {
    if (typeof v !== 'string') return undefined;
    if (v.length > MAX_BODY) return v.slice(0, MAX_BODY);
    return v;
}

function sanitizeImagePath(v: unknown): string | null {
    if (typeof v !== 'string' || !v.trim()) return null;
    const s = v.trim();
    // Accept either a /blog/images/... path we issued, or an absolute https URL.
    if (s.startsWith('/blog/images/') && !s.includes('..')) return s;
    if (/^https:\/\/[^\s"'<>]+$/.test(s)) return s;
    return null;
}

function normalizeSlug(s: string): string {
    return slugify(s, { lower: true, strict: true }).slice(0, MAX_SLUG);
}

function normalizeTag(s: string): string {
    return slugify(s, { lower: true, strict: true }).slice(0, 30);
}

function parseTags(json: string | null | undefined): string[] {
    if (!json) return [];
    try {
        const v = JSON.parse(json);
        if (!Array.isArray(v)) return [];
        return v.filter((t): t is string => typeof t === 'string' && TAG_RE.test(t));
    } catch {
        return [];
    }
}

/** Accept either a comma-separated string or an array; produce a deduped,
 *  validated, capped array of tag slugs. */
function sanitizeTagInput(raw: unknown): string[] {
    let parts: string[] = [];
    if (Array.isArray(raw)) {
        parts = raw.filter((t): t is string => typeof t === 'string');
    } else if (typeof raw === 'string') {
        parts = raw.split(',');
    }
    const out: string[] = [];
    const seen = new Set<string>();
    for (const p of parts) {
        const tag = normalizeTag(p);
        if (!tag || !TAG_RE.test(tag) || seen.has(tag)) continue;
        seen.add(tag);
        out.push(tag);
        if (out.length >= MAX_TAGS_PER_POST) break;
    }
    return out;
}

function imageExtFor(mime: string): string | null {
    switch (mime) {
        case 'image/png':
            return 'png';
        case 'image/jpeg':
            return 'jpg';
        case 'image/webp':
            return 'webp';
        case 'image/gif':
            return 'gif';
        default:
            return null;
    }
}

function stripTags(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function escapeAttr(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** GitHub-style alert blockquotes:
 *   > [!NOTE]
 *   > body
 *  Become <div class="callout callout-note">…</div> with a styled label.
 *  Anything else inside the blockquote stays untouched. */
function processCallouts(html: string): string {
    return html.replace(
        /<blockquote>([\s\S]*?)<\/blockquote>/g,
        (match: string, inner: string): string => {
            const m = inner.match(
                /^\s*<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:<br\s*\/?>|\n|\s)*([\s\S]*)$/i,
            );
            if (!m) return match;
            const type = m[1].toLowerCase();
            const label = type.charAt(0).toUpperCase() + type.slice(1);
            // m[2] is the rest of the blockquote starting from the body of
            // the first <p>. It already contains the closing </p> and any
            // following block elements that markdown-it emitted.
            const body = `<p>${m[2]}`;
            return `<div class="callout callout-${type}"><div class="callout-title">${label}</div>${body}</div>`;
        },
    );
}
