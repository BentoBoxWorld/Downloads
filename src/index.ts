import * as express from 'express';
import apiClass from './api/api';
import * as fs from 'fs';
import * as mime from 'mime-types';
import { ConfigObject } from './config';

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

let env: { github_token?: string; github_downloads?: number; discord_error_webhook_url?: string; port?: number } = {};
try {
    env = require('./../env.json');
} catch (e) {}

const port = env.port || 8080;

app.get('/api/*', function (req, res) {
    apiManager.manageRequest(req, res);
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
