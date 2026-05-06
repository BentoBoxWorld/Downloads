import * as express from 'express';
import apiClass from './api/api';
import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';
import helmet from 'helmet';
import cookieParser = require('cookie-parser');
import { ConfigObject } from './config';
import { upload as blueprintUpload } from './api/submissions';
import { imageUpload as blogImageUpload } from './api/blog';
import * as https from 'https';
import axios from 'axios';

const config: ConfigObject = JSON.parse(fs.readFileSync('./../config.json').toString());

const apiManager = new apiClass(config);
const page = fs.readFileSync('web/index.html');
const app = express.default();
const publicFiles = new Map<string, Buffer>();
fs.readdir('web', (err, files) => {
    files.forEach((file) => {
        publicFiles.set(file, fs.readFileSync(`web/${file}`));
    });
});

let env: {
    github_token?: string;
    github_downloads?: number;
    discord_error_webhook_url?: string;
    port?: number;
} = {};
try {
    env = require('./../env.json');
} catch (e) {}

const port = env.port || 8080;

// In development, webpack's source-map devtool wraps each module in
// eval() — so a strict scriptSrc breaks the page. Allow 'unsafe-eval'
// outside production only.
const isProd = process.env.NODE_ENV === 'production';
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                fontSrc: ["'self'", 'https://fonts.gstatic.com'],
                imgSrc: ["'self'", 'https://cdn.discordapp.com', 'data:'],
                connectSrc: ["'self'", 'https://giscus.app'],
                scriptSrc: isProd
                    ? ["'self'", 'https://giscus.app']
                    : ["'self'", "'unsafe-eval'", 'https://giscus.app'],
                frameSrc: ["'self'", 'https://giscus.app'],
                // Discord OAuth uses top-level navigation; helmet's CSP does
                // not constrain navigation, so no entry for discord.com is
                // needed here. giscus.app is added unconditionally — it's a
                // tiny allowlist entry that lets blog post pages embed the
                // comment widget when configured via env.giscus.
            },
        },
    }),
);
app.use(cookieParser());

app.set('X-Powered-By', 'BentoBox');

// Auth: load session for every /api request, then expose discrete routes.
const wrap = (fn: (...a: unknown[]) => unknown) =>
    (req: express.Request, res: express.Response, next: express.NextFunction) =>
        Promise.resolve()
            .then(() => fn(req, res, next))
            .catch(next);

app.use('/api', wrap(apiManager.auth.loadSession as (...a: unknown[]) => unknown));
app.get('/api/auth/discord/login', wrap(apiManager.auth.handleLogin as (...a: unknown[]) => unknown));
app.get(
    '/api/auth/discord/callback',
    wrap(apiManager.auth.callbackRateLimit as (...a: unknown[]) => unknown),
    wrap(apiManager.auth.handleCallback as (...a: unknown[]) => unknown),
);
app.post(
    '/api/auth/logout',
    express.json(),
    wrap(apiManager.auth.requireCsrf as (...a: unknown[]) => unknown),
    wrap(apiManager.auth.handleLogout as (...a: unknown[]) => unknown),
);
app.get('/api/me', wrap(apiManager.auth.handleMe as (...a: unknown[]) => unknown));
app.post(
    '/api/me/delete',
    express.json(),
    wrap(apiManager.auth.requireCsrf as (...a: unknown[]) => unknown),
    wrap(apiManager.auth.handleDeleteMe as (...a: unknown[]) => unknown),
);

// Blueprint submission: multer parses multipart/form-data; CSRF enforced.
// Cast multer middleware to a plain handler — multer ships its own copy
// of @types/express which collides with the project's.
const multerSingle = blueprintUpload.single('blueprint') as unknown as (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
) => void;

app.post(
    '/api/blueprints/submit',
    wrap(apiManager.auth.requireCsrf as (...a: unknown[]) => unknown),
    multerSingle,
    wrap(apiManager.submissions.handleSubmit as (...a: unknown[]) => unknown),
);

// Blog: public read endpoints + author-gated write endpoints.
app.get('/api/blog/posts', wrap(apiManager.blog.handleListPosts as (...a: unknown[]) => unknown));
app.get(
    '/api/blog/posts/:slug',
    wrap(apiManager.blog.handleGetPost as (...a: unknown[]) => unknown),
);
app.get('/api/blog/feed.xml', wrap(apiManager.blog.handleRss as (...a: unknown[]) => unknown));
app.get('/api/blog/tags', wrap(apiManager.blog.handleListTags as (...a: unknown[]) => unknown));
app.get(
    '/api/blog/comments-config',
    wrap(apiManager.blog.handleCommentsConfig as (...a: unknown[]) => unknown),
);

app.get(
    '/api/blog/admin/posts',
    wrap(apiManager.auth.requireBlogAuthor as (...a: unknown[]) => unknown),
    wrap(apiManager.blog.handleListAdminPosts as (...a: unknown[]) => unknown),
);
app.get(
    '/api/blog/admin/posts/:id',
    wrap(apiManager.auth.requireBlogAuthor as (...a: unknown[]) => unknown),
    wrap(apiManager.blog.handleGetAdminPost as (...a: unknown[]) => unknown),
);
app.post(
    '/api/blog/admin/posts',
    express.json({ limit: '512kb' }),
    wrap(apiManager.auth.requireCsrf as (...a: unknown[]) => unknown),
    wrap(apiManager.auth.requireBlogAuthor as (...a: unknown[]) => unknown),
    wrap(apiManager.blog.handleCreatePost as (...a: unknown[]) => unknown),
);
app.put(
    '/api/blog/admin/posts/:id',
    express.json({ limit: '512kb' }),
    wrap(apiManager.auth.requireCsrf as (...a: unknown[]) => unknown),
    wrap(apiManager.auth.requireBlogAuthor as (...a: unknown[]) => unknown),
    wrap(apiManager.blog.handleUpdatePost as (...a: unknown[]) => unknown),
);
app.post(
    '/api/blog/admin/posts/:id/publish',
    express.json({ limit: '4kb' }),
    wrap(apiManager.auth.requireCsrf as (...a: unknown[]) => unknown),
    wrap(apiManager.auth.requireBlogAuthor as (...a: unknown[]) => unknown),
    wrap(apiManager.blog.handlePublishPost as (...a: unknown[]) => unknown),
);
app.post(
    '/api/blog/admin/posts/:id/unpublish',
    wrap(apiManager.auth.requireCsrf as (...a: unknown[]) => unknown),
    wrap(apiManager.auth.requireBlogAuthor as (...a: unknown[]) => unknown),
    wrap(apiManager.blog.handleUnpublishPost as (...a: unknown[]) => unknown),
);
app.delete(
    '/api/blog/admin/posts/:id',
    wrap(apiManager.auth.requireCsrf as (...a: unknown[]) => unknown),
    wrap(apiManager.auth.requireBlogAuthor as (...a: unknown[]) => unknown),
    wrap(apiManager.blog.handleDeletePost as (...a: unknown[]) => unknown),
);
const blogImageMiddleware = blogImageUpload.single('image') as unknown as (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
) => void;
app.post(
    '/api/blog/admin/images',
    wrap(apiManager.auth.requireCsrf as (...a: unknown[]) => unknown),
    wrap(apiManager.auth.requireBlogAuthor as (...a: unknown[]) => unknown),
    blogImageMiddleware,
    wrap(apiManager.blog.handleUploadImage as (...a: unknown[]) => unknown),
);
app.get(
    '/api/me/submissions',
    wrap(apiManager.auth.requireSession as (...a: unknown[]) => unknown),
    wrap(apiManager.submissions.handleMySubmissions as (...a: unknown[]) => unknown),
);

// Admin routes — gated by requireAdmin (which checks requireSession internally).
// Mutations also require requireCsrf.
app.get(
    '/api/admin/users',
    wrap(apiManager.auth.requireAdmin as (...a: unknown[]) => unknown),
    wrap(apiManager.admin.handleListAdmins as (...a: unknown[]) => unknown),
);
app.post(
    '/api/admin/users',
    express.json(),
    wrap(apiManager.auth.requireCsrf as (...a: unknown[]) => unknown),
    wrap(apiManager.auth.requireAdmin as (...a: unknown[]) => unknown),
    wrap(apiManager.admin.handleSetAdmin as (...a: unknown[]) => unknown),
);
app.get(
    '/api/admin/authors',
    wrap(apiManager.auth.requireAdmin as (...a: unknown[]) => unknown),
    wrap(apiManager.admin.handleListAuthors as (...a: unknown[]) => unknown),
);
app.post(
    '/api/admin/authors',
    express.json(),
    wrap(apiManager.auth.requireCsrf as (...a: unknown[]) => unknown),
    wrap(apiManager.auth.requireAdmin as (...a: unknown[]) => unknown),
    wrap(apiManager.admin.handleSetAuthor as (...a: unknown[]) => unknown),
);
app.get(
    '/api/admin/presets',
    wrap(apiManager.auth.requireAdmin as (...a: unknown[]) => unknown),
    wrap(apiManager.admin.handleListPresets as (...a: unknown[]) => unknown),
);
app.put(
    '/api/admin/presets',
    express.json({ limit: '512kb' }),
    wrap(apiManager.auth.requireCsrf as (...a: unknown[]) => unknown),
    wrap(apiManager.auth.requireAdmin as (...a: unknown[]) => unknown),
    wrap(apiManager.admin.handleUpdatePresets as (...a: unknown[]) => unknown),
);
app.get(
    '/api/admin/addons',
    wrap(apiManager.auth.requireAdmin as (...a: unknown[]) => unknown),
    wrap(apiManager.admin.handleListAddons as (...a: unknown[]) => unknown),
);
app.post(
    '/api/admin/addons',
    express.json({ limit: '256kb' }),
    wrap(apiManager.auth.requireCsrf as (...a: unknown[]) => unknown),
    wrap(apiManager.auth.requireAdmin as (...a: unknown[]) => unknown),
    wrap(apiManager.admin.handleCreateAddon as (...a: unknown[]) => unknown),
);
app.put(
    '/api/admin/addons/:name',
    express.json({ limit: '256kb' }),
    wrap(apiManager.auth.requireCsrf as (...a: unknown[]) => unknown),
    wrap(apiManager.auth.requireAdmin as (...a: unknown[]) => unknown),
    wrap(apiManager.admin.handleUpdateAddon as (...a: unknown[]) => unknown),
);
app.delete(
    '/api/admin/addons/:name',
    wrap(apiManager.auth.requireCsrf as (...a: unknown[]) => unknown),
    wrap(apiManager.auth.requireAdmin as (...a: unknown[]) => unknown),
    wrap(apiManager.admin.handleDeleteAddon as (...a: unknown[]) => unknown),
);
app.get(
    '/api/admin/audits',
    wrap(apiManager.auth.requireAdmin as (...a: unknown[]) => unknown),
    wrap(apiManager.admin.handleListAudits as (...a: unknown[]) => unknown),
);
app.get(
    '/api/admin/overrides',
    wrap(apiManager.auth.requireAdmin as (...a: unknown[]) => unknown),
    wrap(apiManager.admin.handleListOverrides as (...a: unknown[]) => unknown),
);
app.delete(
    '/api/admin/overrides/:scope',
    wrap(apiManager.auth.requireCsrf as (...a: unknown[]) => unknown),
    wrap(apiManager.auth.requireAdmin as (...a: unknown[]) => unknown),
    wrap(apiManager.admin.handleResetOverride as (...a: unknown[]) => unknown),
);
app.post(
    '/api/admin/pr',
    express.json(),
    wrap(apiManager.auth.requireCsrf as (...a: unknown[]) => unknown),
    wrap(apiManager.auth.requireAdmin as (...a: unknown[]) => unknown),
    wrap(apiManager.admin.handleOpenPr as (...a: unknown[]) => unknown),
);

app.get('/api/*', function (req, res) {
    apiManager.manageRequest(req, res);
});

// highlight.js CSS — read once at startup. We keep our own dark code-block
// background (#1a1d24) by appending an override so syntax themes blend with
// the existing post styles. Failure here is non-fatal; the page just renders
// without colored tokens.
let highlightCss = '';
try {
    const themeFile = require.resolve('highlight.js/styles/github-dark.css');
    highlightCss =
        fs.readFileSync(themeFile, 'utf-8') +
        '\n.hljs { background: #1a1d24 !important; padding: 14px 16px; border-radius: 8px; }';
} catch {
    /* ignore — fallback is no syntax colors */
}
app.get('/blog/highlight.css', function (_req, res) {
    res.set('Content-Type', 'text/css; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(highlightCss);
});

// Blog image static handler. Path-traversal guarded; only known image
// extensions are served. The directory is created lazily by BlogManager.
const BLOG_IMAGE_ROOT = path.resolve('./../data/blog/images');
const BLOG_IMAGE_MIME: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
};
app.get('/blog/images/*', function (req, res) {
    const rel = req.url.slice('/blog/images/'.length).split('?')[0].split('#')[0];
    const m = rel.match(/^([A-Za-z0-9._/-]+)\.([A-Za-z0-9]+)$/);
    if (!m || rel.includes('..')) {
        res.status(404).end();
        return;
    }
    const ext = m[2].toLowerCase();
    const ctype = BLOG_IMAGE_MIME[ext];
    if (!ctype) {
        res.status(404).end();
        return;
    }
    const target = path.resolve(BLOG_IMAGE_ROOT, rel);
    if (!target.startsWith(BLOG_IMAGE_ROOT + path.sep)) {
        res.status(404).end();
        return;
    }
    fs.stat(target, (err, stat) => {
        if (err || !stat.isFile()) {
            res.status(404).end();
            return;
        }
        res.set('Content-Type', ctype);
        res.set('Cache-Control', 'public, max-age=86400, immutable');
        fs.createReadStream(target).pipe(res);
    });
});

// RSS + canonical-permalink convenience routes. These mirror the API
// endpoints under "user-friendly" URLs. On blog.bentobox.world, the bare
// /feed.xml works; on download.bentobox.world, use /blog/feed.xml.
function isBlogHost(req: express.Request): boolean {
    const host = (req.hostname || '').toLowerCase();
    return host === 'blog.bentobox.world' || host.startsWith('blog.');
}
app.get('/blog/feed.xml', wrap(apiManager.blog.handleRss as (...a: unknown[]) => unknown));
app.get('/feed.xml', function (req, res, next) {
    if (!isBlogHost(req)) return next();
    return (apiManager.blog.handleRss as express.RequestHandler)(req, res, next);
});
app.get('/blog/sitemap.xml', wrap(apiManager.blog.handleSitemap as (...a: unknown[]) => unknown));
app.get('/sitemap.xml', function (req, res, next) {
    if (!isBlogHost(req)) return next();
    return (apiManager.blog.handleSitemap as express.RequestHandler)(req, res, next);
});

app.get('/blueprints/images/*', function (req, res) {
    // PNG-only static handler for the cloned weblink/blueprints/images tree.
    // Path-traversal guarded; everything else 404s.
    const rel = req.url.slice('/blueprints/images/'.length).split('?')[0].split('#')[0];
    if (!/^[A-Za-z0-9._/-]+\.(png|PNG)$/.test(rel) || rel.includes('..')) {
        res.status(404).end();
        return;
    }
    const root = path.resolve(apiManager.weblink.blueprintsDir, 'images');
    const target = path.resolve(root, rel);
    if (!target.startsWith(root + path.sep)) {
        res.status(404).end();
        return;
    }
    fs.stat(target, (err, stat) => {
        if (err || !stat.isFile()) {
            res.status(404).end();
            return;
        }
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'public, max-age=600');
        fs.createReadStream(target).pipe(res);
    });
});

// Server-render blog post pages so OG/Twitter scrapers and search engines
// see real metadata. The React app on the client takes over for navigation.
async function serveBlogPostPage(slug: string, res: express.Response): Promise<boolean> {
    try {
        const html = await apiManager.blog.renderPostPage(slug, page.toString('utf-8'));
        if (!html) return false;
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
        return true;
    } catch (err) {
        console.error('[blog] SSR failed:', (err as Error)?.message ?? err);
        return false;
    }
}
app.get('/blog/p/:slug', async function (req, res, next) {
    const slug = String(req.params.slug || '');
    if (!(await serveBlogPostPage(slug, res))) return next();
});
app.get('/p/:slug', async function (req, res, next) {
    if (!isBlogHost(req)) return next();
    const slug = String(req.params.slug || '');
    if (!(await serveBlogPostPage(slug, res))) return next();
});

app.get('*', function (req, res) {
    if (publicFiles.has(req.url.slice(1))) {
        res.set('Content-Type', mime.lookup(req.url.slice(1)) || '');
        switch (mime.lookup(req.url.slice(1))) {
            case 'image/jpeg':
            case 'text/css':
            case 'text/javascript':
            case 'application/javascript':
                res.set('Cache-Control', 'public, max-age=1200');
                break;
            default:
                break;
        }
        res.end(publicFiles.get(req.url.slice(1)));
        return;
    }
    res.set('Content-Type', 'text/html');
    res.send(page);
});

app.listen(port, () => {
    console.log(`Web server running on http://localhost${port != 80 ? `:${port}` : ''}/`);
});

process.on('uncaughtException', async function (err) {
    const stack = await axios.post('https://paste.md-5.net/documents', err.stack, {
        headers: { 'Content-Type': 'text/plain' },
    });
    console.log('Caught exception: ' + err);
    console.log('Stack: https://paste.md-5.net/' + stack.data.key);

    if (env.discord_error_webhook_url) {
        const data = new TextEncoder().encode(
            JSON.stringify({
                embeds: [
                    {
                        title: '**Website Error**',
                        description:
                            'The Downloads Site Has Thrown a new Exception: \n`' +
                            err +
                            '`\nStack: https://paste.md-5.net/' +
                            stack.data.key,
                        color: 16711680,
                    },
                ],
            }),
        );
        const req = https.request({
            hostname: 'discord.com',
            port: 443,
            path: env.discord_error_webhook_url,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length,
            },
        });
        req.write(data);
        req.end();
    }
});
