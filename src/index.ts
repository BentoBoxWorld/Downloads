import * as express from 'express';
import apiClass from './api/api';
import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';
import helmet from 'helmet';
import cookieParser = require('cookie-parser');
import { ConfigObject } from './config';
import { upload as blueprintUpload } from './api/submissions';
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
                connectSrc: ["'self'"],
                scriptSrc: isProd ? ["'self'"] : ["'self'", "'unsafe-eval'"],
                // Discord OAuth uses top-level navigation; helmet's CSP does
                // not constrain navigation, so no entry for discord.com is
                // needed here.
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
