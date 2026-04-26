import { Request, Response } from 'express';
import { AddonsEntity, AddonType, ConfigObject, ThirdParty } from '../config';
import { Octokit } from 'octokit';
import * as cron from 'node-cron';
import {
    DatabaseFactory,
    DatabaseModel,
    DownloadCountFactory,
    DownloadCountModel,
    OldVersionFactory,
} from './models/database';
import { Sequelize } from 'sequelize';
import { JenkinsAPI } from 'jenkins';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import Archiver = require('archiver');
import { WeblinkSync } from './weblink';
import {
    BlueprintCatalog,
    buildCatalog,
    parseBlueprintId,
    resolveBlueprintFile,
} from './blueprintCatalog';
import { AdminManager } from './admin';
import { AuthConfig, AuthManager } from './auth';
import { ConfigStore } from './configStore';
import { SubmissionManager } from './submissions';

const { throttling } = require('@octokit/plugin-throttling');

// Ensure the data/ directory exists for Auth.sqlite + weblink clone.
try {
    fs.mkdirSync('./../data', { recursive: true });
} catch (e) {}

export default class ApiManager {
    config: ConfigObject;
    addons: AddonType[] = [];
    octokit: Octokit;
    jenkins: JenkinsAPI = require('jenkins')({ baseUrl: 'https://ci.codemc.io' });
    tutorial = fs.readFileSync('../Installation-Guide.txt');
    thirdParty: ThirdParty = JSON.parse(fs.readFileSync('./../thirdparty.json').toString());

    weblink: WeblinkSync = this.createWeblinkSync();
    blueprintCatalog: BlueprintCatalog = {
        blueprints: [],
        bundles: [],
        tags: {},
        gameModes: {},
        generatedAt: 0,
    };

    authSequelize = new Sequelize('auth', 'user', 'password', {
        host: 'localhost',
        dialect: 'sqlite',
        logging: false,
        storage: './../data/Auth.sqlite',
    });
    auth: AuthManager = new AuthManager(this.loadAuthConfig(), this.authSequelize);
    configStore: ConfigStore;
    admin: AdminManager = new AdminManager(this.auth);
    submissions: SubmissionManager = new SubmissionManager(this.auth, this.weblink, this.loadSubmissionsConfig());

    jarSequelize = new Sequelize('database', 'user', 'password', {
        host: 'localhost',
        dialect: 'sqlite',
        logging: false,
        storage: './../JarCache.sqlite',
    });

    jarCache = DatabaseFactory(this.jarSequelize);
    oldVersionCache = OldVersionFactory(this.jarSequelize);

    downloadCount = DownloadCountFactory(
        new Sequelize('database', 'user', 'password', {
            host: 'localhost',
            dialect: 'sqlite',
            logging: false,
            storage: './../Downloads.sqlite',
        }),
    );

    constructor(private readonly configConstructor: ConfigObject) {
        this.downloadCount.sync().then(async () => {
            for await (const addon of configConstructor.addons) {
                if (addon.name === 'BentoBox') continue;
                const addonDownloads: DownloadCountModel | null = await Promise.resolve(
                    this.downloadCount.findOne({
                        where: { name: addon.name },
                    }),
                );
                if (addonDownloads === null) {
                    await this.downloadCount.create({
                        name: addon.name,
                        downloads: 0,
                    });
                }

                await this.generateDownloads();
            }
        });
        this.oldVersionCache.sync();
        this.jarCache.sync().then(async () => {
            const undefinedAddons: AddonsEntity[] = [];
            for await (const addon of configConstructor.addons) {
                const addonDatabase: DatabaseModel | null = await Promise.resolve(
                    this.jarCache.findOne({
                        where: { name: addon.name },
                    }),
                );
                if (addonDatabase === null) undefinedAddons.push(addon);
            }
            const repeats = env && env.github_downloads ? env.github_downloads : 1;
            let updateAddon = 0;
            let updateCiAddon = 0;
            const oldAddons: Record<string, string[]> = {};
            configConstructor.addons.forEach((a) => {
                if (!a.versions) return;
                oldAddons[a.name] = Object.values(a.versions);
            });
            const oldAddonList: { addon: string; version: string }[] = [];
            for (const oldAddonsKey in oldAddons) {
                for (const versionID in oldAddons[oldAddonsKey]) {
                    const version = await this.oldVersionCache
                        .findAll({
                            where: {
                                name: oldAddonsKey,
                                version: oldAddons[oldAddonsKey][versionID],
                            },
                        })
                        .then((r) => r && r.length > 0);
                    if (!version) {
                        oldAddonList.push({ addon: oldAddonsKey, version: oldAddons[oldAddonsKey][versionID] });
                    }
                }
            }
            cron.schedule('*/6 * * * *', () => {
                this.generateDownloads();
                this.refreshBlueprints();
                if (undefinedAddons.length > 0) {
                    for (let i = 0; i < (undefinedAddons.length > repeats ? repeats : undefinedAddons.length); i++) {
                        this.updateAsset(undefinedAddons[0]).then();
                        undefinedAddons.shift();
                    }
                } else if (oldAddonList.length > 0) {
                    for (let i = 0; i < (oldAddonList.length > repeats ? repeats : oldAddonList.length); i++) {
                        this.downloadOldVersion(oldAddonList[0]).then();
                        oldAddonList.shift();
                    }
                } else {
                    for (let i = 0; i < repeats; i++) {
                        this.updateAsset(configConstructor.addons[updateAddon]).then();
                        updateAddon++;
                        if (updateAddon >= configConstructor.addons.length) updateAddon = 0;
                    }
                }
                for (let i = 0; i < 4; i++) {
                    this.updateJenkins(configConstructor.addons[updateCiAddon]).then();
                    updateCiAddon++;
                    if (updateCiAddon >= configConstructor.addons.length) updateCiAddon = 0;
                }
            });
        });
        let env: {
            github_token?: string;
            github_downloads?: number;
            discord_error_webhook_url?: string;
            port?: number;
        } = {};
        try {
            env = require('./../../env.json');
        } catch (e) {}
        const CustomOctokit = Octokit.plugin(throttling);
        this.octokit = new CustomOctokit({
            auth: env && env.github_token ? env.github_token : '',
        });
        this.configStore = new ConfigStore(configConstructor, this.authSequelize);
        this.config = configConstructor;

        // Once the override layer has loaded from disk, swap in the effective
        // config and (re)build the derived addons array off it.
        this.configStore.ready
            .then(() => this.reload())
            .catch((err) => console.error('[api] initial configStore load failed:', err));

        this.refreshBlueprints();
    }

    private async rebuildAddons(): Promise<void> {
        const next: AddonType[] = [];
        for await (const addon1 of this.config.addons) {
            const cached = await this.jarCache.findOne({ where: { name: addon1.name } });
            const versions = {
                latest: cached?.version || '0',
                beta: cached?.ciId?.toString() || '0',
                ...addon1.versions,
            };
            next.push({
                name: addon1.name,
                description: addon1.description,
                gamemode: addon1.gamemode,
                github: addon1.github,
                versions: versions,
            });
        }
        // Replace contents in-place so any captured references stay valid.
        this.addons.length = 0;
        this.addons.push(...next);
    }

    async reload(): Promise<void> {
        this.config = this.configStore.getEffectiveConfig();
        await this.rebuildAddons();
    }

    private createWeblinkSync(): WeblinkSync {
        let overrides: Partial<{ url: string; path: string; branch: string }> = {};
        try {
            const env = require('./../../env.json');
            if (env && env.weblink) overrides = env.weblink;
        } catch (e) {}
        return new WeblinkSync(overrides);
    }

    private loadSubmissionsConfig() {
        try {
            const env = require('./../../env.json');
            if (env && env.weblink_github_token) {
                return {
                    weblinkRepo: { owner: 'BentoBoxWorld', repo: 'weblink' },
                    weblinkToken: env.weblink_github_token as string,
                    weblinkBranch: (env.weblink && env.weblink.branch) || 'master',
                };
            }
        } catch (e) {}
        return null;
    }

    private loadAuthConfig(): AuthConfig | null {
        try {
            const env = require('./../../env.json');
            const inProd = process.env.NODE_ENV === 'production';
            if (env && env.discord_client_id && env.discord_client_secret && env.discord_redirect_uri) {
                const adminDiscordIds = Array.isArray(env.admin_discord_ids)
                    ? (env.admin_discord_ids as unknown[]).filter((x): x is string => typeof x === 'string')
                    : [];
                return {
                    clientId: env.discord_client_id,
                    clientSecret: env.discord_client_secret,
                    redirectUri: env.discord_redirect_uri,
                    cookieSecure: inProd,
                    adminDiscordIds,
                };
            }
        } catch (e) {}
        return null;
    }

    async refreshBlueprints() {
        try {
            await this.weblink.sync();
            this.blueprintCatalog = buildCatalog(this.weblink.blueprintsDir);
        } catch (err) {
            console.error('[blueprints] refresh failed:', (err as Error).message);
        }
    }

    async updateJenkins(addon: AddonsEntity) {
        const jenkins = this.jenkins;
        const getBase64 = this.getBase64;
        const project = addon.ci;
        const addonDatabase: DatabaseModel | null = await this.jarCache.findOne({ where: { name: addon.name } });
        if (addonDatabase === null) return;
        const latestJenkins = await this.getLatestJenkins(addon);
        if (addonDatabase.ciId && addonDatabase.ciId === latestJenkins) return;
        jenkins.build.get(project, latestJenkins, async (err, data) => {
            let assetURL;
            if (data.length === 0) {
                return;
            } else if (data.artifacts.length === 1) {
                assetURL = data.artifacts[0].fileName;
            } else {
                for (let i = 0; i < data.artifacts.length; i++) {
                    if (
                        !data.artifacts[i].fileName
                            .toLowerCase()
                            .match(`[a-zA-Z]{3,20}-[0-9.]{1,10}(?:-snapshot-b[0-9]{0,20})?.jar`) &&
                        i + 1 != data.artifacts.length
                    )
                        continue;
                    assetURL = data.artifacts[i].fileName;
                }
                if (!assetURL) return;
            }
            const buffer = await getBase64(
                `https://ci.codemc.io/job/${project.split('/')[0]}/job/${
                    project.split('/')[1]
                }/lastSuccessfulBuild/artifact/target/${assetURL}`,
            );
            addonDatabase.update({
                ci: buffer,
                ciId: latestJenkins,
                ciJarFile: assetURL,
            });
            this.addons.filter((a) => a.name === addon.name)[0].versions.beta = String(latestJenkins);
        });
    }

    async getLatestJenkins(addon: AddonsEntity): Promise<number> {
        const project = addon.ci;
        return (await this.getJob(project)).lastSuccessfulBuild.number;
    }

    getJob(project: string): Promise<{ lastSuccessfulBuild: { number: number } }> {
        return new Promise((res, rej) => {
            this.jenkins.job.get(project, (err, data) => {
                res(data);
                rej(err);
            });
        });
    }

    async updateAsset(addon: AddonsEntity) {
        let latestRelease;
        try {
            latestRelease = await this.octokit.rest.repos.getLatestRelease({
                owner: addon.github.split('/')[0],
                repo: addon.github.split('/')[1],
            });
        } catch (e) {
            const data = await this.octokit.rest.repos.listReleases({
                owner: addon.github.split('/')[0],
                repo: addon.github.split('/')[1],
            });
            latestRelease = await this.octokit.rest.repos.getRelease({
                owner: addon.github.split('/')[0],
                repo: addon.github.split('/')[1],
                release_id: data.data[data.data.length - 1].id,
            });
        }

        const addonDatabase: DatabaseModel | null = await this.jarCache.findOne({ where: { name: addon.name } });

        if (addonDatabase && latestRelease.data.id === addonDatabase.releaseId) return;

        const releaseFiles = await this.octokit.rest.repos.listReleaseAssets({
            owner: addon.github.split('/')[0],
            repo: addon.github.split('/')[1],
            release_id: latestRelease.data.id,
        });
        let assetURL;
        if (releaseFiles.data.length === 0) {
            return;
        } else if (releaseFiles.data.length === 1) {
            assetURL = releaseFiles.data[0];
        } else {
            for (let i = 0; i < releaseFiles.data.length; i++) {
                if (
                    !releaseFiles.data[i].name
                        .toLowerCase()
                        .match(`[a-zA-Z]{3,20}-[0-9.]{1,10}(?:-snapshot-b[0-9]{0,20})?.jar`)
                )
                    continue;
                assetURL = releaseFiles.data[i];
            }
            if (!assetURL) return;
        }
        if (!assetURL) return;
        const asset = await this.octokit.rest.repos.getReleaseAsset({
            owner: addon.github.split('/')[0],
            repo: addon.github.split('/')[1],
            asset_id: assetURL.id,
            headers: {
                accept: 'application/octet-stream',
            },
        });
        if (addonDatabase === null) {
            await this.jarCache.create({
                name: addon.name,
                release: Buffer.from(<ArrayBuffer>(<unknown>asset.data)),
                releaseId: latestRelease.data.id,
                releaseJarFile: assetURL.name,
                lastUpdated: Date.now(),
                version: latestRelease.data.tag_name,
            });
        } else {
            addonDatabase.update({
                release: Buffer.from(<ArrayBuffer>(<unknown>asset.data)),
                releaseId: latestRelease.data.id,
                releaseJarFile: assetURL.name,
                lastUpdated: Date.now(),
                version: latestRelease.data.tag_name,
            });
        }
        const oldAddon = this.addons.filter((a) => a.name === addon.name)[0];
        const newAddon = oldAddon;
        newAddon.versions['latest'] = latestRelease.data.tag_name;
        this.addons[this.addons.indexOf(oldAddon)] = newAddon;
    }

    manageRequest(req: Request, res: Response) {
        const endpoint = req.url.slice(5).split('?')[0].split('#')[0];
        switch (endpoint) {
            case 'presets':
                res.setHeader('Content-Type', 'application/json');
                res.send(this.config.presets);
                res.end();
                break;

            case 'addons':
                res.setHeader('Content-Type', 'application/json');
                res.send(this.addons);
                res.end();
                break;
            case 'thirdparty':
                res.setHeader('Content-Type', 'application/json');
                res.send(this.thirdParty);
                res.end();
                break;
            case 'blueprints':
                res.setHeader('Content-Type', 'application/json');
                res.send(this.blueprintCatalog);
                res.end();
                break;
            case 'blueprints/download':
                this.downloadBlueprintFile(req, res);
                break;
            case 'blueprints/zip':
                this.downloadBlueprintZip(req, res).then();
                break;
            case 'generate':
                this.generateZIP(req, res).then();
                break;
            default:
                res.setHeader('Content-Type', 'application/json');
                res.send({ Error: 404 });
                res.statusCode = 404;
                res.end();
        }
    }

    async generateZIP(req: Request, res: Response) {
        const downloadArg = req.query.downloads;
        let version = req.query.version ? req.query.version : 'latest';
        if (!downloadArg) {
            res.setHeader('Content-Type', 'application/json');
            res.send({ Error: 400, Reason: 'No Addons Selected' });
            res.statusCode = 400;
            res.end();
            return;
        }
        let addonNames: string[];
        try {
            addonNames = JSON.parse(decodeURI(downloadArg.toString()));
            if (addonNames.length === 0) {
                res.setHeader('Content-Type', 'application/json');
                res.send({ Error: 400, Reason: 'No Addons Selected' });
                res.statusCode = 400;
                res.end();
                return;
            }
        } catch (e) {
            res.setHeader('Content-Type', 'application/json');
            res.send({ Error: 400, Reason: 'Not Valid Json' });
            res.statusCode = 400;
            res.end();
            return;
        }
        let doReturn = false;
        addonNames.forEach((addon) => {
            // Ignore The Weird Casts, Just to remove IDE errors (:
            if (!doReturn && typeof (<string | number>addon) !== 'string') {
                res.setHeader('Content-Type', 'application/json');
                res.send({ Error: 400, Reason: 'Not A Valid String' });
                res.statusCode = 400;
                res.end();
                doReturn = true;
            }
            return addon;
        });
        if (doReturn) return;
        const addons: AddonType[] = [];
        addonNames.forEach((addon) => {
            if (doReturn) return;
            const addonByType = this.addons.filter((a) => a.name === addon);
            if (addonByType.length === 0 || addon.toLowerCase() === 'bentobox') {
                res.setHeader('Content-Type', 'application/json');
                res.send({ Error: 400, Reason: 'Invalid Addon' });
                res.statusCode = 400;
                res.end();
                doReturn = true;
                return;
            }
            addons.push(addonByType[0]);
        });
        if (doReturn) return;

        const archive = Archiver('zip');

        archive.on('error', function (err) {
            res.status(500).send({ error: err.message });
        });

        archive.on('end', function () {
            res.end();
        });

        res.attachment('bentobox.zip');

        archive.pipe(res);

        if (version === 'beta') {
            const bentoBoxJar: DatabaseModel | null = await this.jarCache.findOne({ where: { name: 'BentoBox' } });
            if (bentoBoxJar) {
                if (bentoBoxJar.ci && bentoBoxJar.ciJarFile) {
                    archive.append(bentoBoxJar.ci, { name: bentoBoxJar.ciJarFile });
                }
            }
        } else if (version === 'latest') {
            const bentoBoxJar: DatabaseModel | null = await this.jarCache.findOne({ where: { name: 'BentoBox' } });
            if (bentoBoxJar) {
                archive.append(bentoBoxJar.release, { name: bentoBoxJar.releaseJarFile });
            }
        } else {
            const bentoBoxVersions = await this.oldVersionCache.findAll({
                where: {
                    name: 'BentoBox',
                },
            });
            const bentoBoxJar = bentoBoxVersions.filter((a) => {
                const addons = this.configConstructor.addons.filter((a) => a.name === 'BentoBox')[0];
                if (!addons.versions) return;
                return a.version === addons.versions[<string>version];
            })[0];
            if (bentoBoxJar) {
                archive.append(bentoBoxJar.release, { name: bentoBoxJar.releaseJarFile });
            }
        }
        archive.append(
            this.tutorial
                .toString()
                .replace(
                    '{[setup-info]}',
                    `Addons: ${addons.map(
                        (a) => `\n   ${a.name}`,
                    )} \n\nSetup Link: https://download.bentobox.world/custom${
                        version && version !== 'latest' ? `?v=${version}` : ''
                    }#${'[' + addonNames.map((a) => '"' + a + '"').join(',') + ']'}`,
                ),
            {
                name: 'Installation-Guide.txt',
            },
        );
        for (const addon of addons) {
            if (typeof version !== 'string') version = 'latest';
            if (version === 'beta') {
                const addonJar: DatabaseModel | null = await this.jarCache.findOne({ where: { name: addon.name } });
                if (addonJar) {
                    if (addonJar.ci && addonJar.ciJarFile) {
                        archive.append(addonJar.ci, { name: 'BentoBox/addons/' + addonJar.ciJarFile });
                    }
                }
            } else if (version === 'latest') {
                const addonJar: DatabaseModel | null = await this.jarCache.findOne({ where: { name: addon.name } });
                if (addonJar) {
                    archive.append(addonJar.release, { name: 'BentoBox/addons/' + addonJar.releaseJarFile });
                }
            } else {
                const addonVersions = await this.oldVersionCache.findAll({
                    where: {
                        name: addon.name,
                    },
                });
                const addonJar = addonVersions.filter((a) => a.version === addon.versions[<string>version])[0];
                if (addonJar) {
                    archive.append(addonJar.release, { name: 'BentoBox/addons/' + addonJar.releaseJarFile });
                }
            }
        }
        await archive.finalize();

        for (const addon of addons) {
            await this.updateDownloadCount(addon.name);
        }
    }

    downloadBlueprintFile(req: Request, res: Response) {
        const id = typeof req.query.id === 'string' ? req.query.id : '';
        const type = req.query.type === 'bundle' ? 'bundle' : 'blueprint';
        const ext = type === 'bundle' ? '.json' : '.blueprint';
        const abs = resolveBlueprintFile(this.weblink.blueprintsDir, id, ext);
        if (!abs) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 404;
            res.send({ Error: 404, Reason: 'Unknown blueprint' });
            res.end();
            return;
        }
        const filename = path.basename(abs);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        fs.createReadStream(abs).pipe(res);
    }

    async downloadBlueprintZip(req: Request, res: Response) {
        const idsParam = typeof req.query.ids === 'string' ? req.query.ids : '';
        const gameMode = typeof req.query.gameMode === 'string' ? req.query.gameMode : '';
        const entries: Array<{ abs: string; name: string }> = [];

        if (gameMode) {
            const parsed = parseBlueprintId(`${gameMode}/stub`);
            if (!parsed) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 400;
                res.send({ Error: 400, Reason: 'Invalid gameMode' });
                res.end();
                return;
            }
            for (const bp of this.blueprintCatalog.blueprints) {
                if (bp.gameMode === gameMode) {
                    const abs = path.resolve(this.weblink.blueprintsDir, bp.file);
                    entries.push({ abs, name: bp.file });
                }
            }
            for (const bd of this.blueprintCatalog.bundles) {
                if (bd.gameMode === gameMode) {
                    const abs = path.resolve(this.weblink.blueprintsDir, bd.file);
                    entries.push({ abs, name: bd.file });
                }
            }
        } else if (idsParam) {
            let ids: unknown;
            try {
                ids = JSON.parse(decodeURIComponent(idsParam));
            } catch {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 400;
                res.send({ Error: 400, Reason: 'Not Valid Json' });
                res.end();
                return;
            }
            if (!Array.isArray(ids) || ids.length === 0) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 400;
                res.send({ Error: 400, Reason: 'No Blueprints Selected' });
                res.end();
                return;
            }
            for (const id of ids) {
                if (typeof id !== 'string') continue;
                const abs = resolveBlueprintFile(this.weblink.blueprintsDir, id, '.blueprint');
                if (abs) {
                    const parsed = parseBlueprintId(id);
                    if (parsed) entries.push({ abs, name: `${parsed.gameMode}/${parsed.name}.blueprint` });
                    continue;
                }
                const absBundle = resolveBlueprintFile(this.weblink.blueprintsDir, id, '.json');
                if (absBundle) {
                    const parsed = parseBlueprintId(id);
                    if (parsed) entries.push({ abs: absBundle, name: `${parsed.gameMode}/${parsed.name}.json` });
                }
            }
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 400;
            res.send({ Error: 400, Reason: 'Provide ids or gameMode' });
            res.end();
            return;
        }

        if (entries.length === 0) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 404;
            res.send({ Error: 404, Reason: 'No matching blueprints' });
            res.end();
            return;
        }

        const archive = Archiver('zip');
        archive.on('error', (err) => {
            res.status(500).send({ error: err.message });
        });
        archive.on('end', () => res.end());

        const zipName = gameMode ? `blueprints-${gameMode}.zip` : 'blueprints.zip';
        res.attachment(zipName);
        archive.pipe(res);
        for (const e of entries) {
            archive.file(e.abs, { name: e.name });
        }
        await archive.finalize();
    }

    async updateDownloadCount(addon: string) {
        const addonDatabase: DownloadCountModel | null = await this.downloadCount.findOne({
            where: { name: addon },
        });
        if (addonDatabase !== null) {
            addonDatabase.update({ downloads: addonDatabase.downloads + 1 });
        }
    }

    async generateDownloads() {
        this.addons.map(async (a) => {
            const downloadCount = await this.downloadCount.findOne({ where: { name: a.name } });
            a.downloads = downloadCount?.downloads;
        });
    }

    getBase64(url: string) {
        return axios
            .get(url, {
                responseType: 'arraybuffer',
            })
            .then((response) => Buffer.from(response.data, 'binary'));
    }

    async downloadOldVersion(details: { addon: string; version: string }) {
        let release;
        let addon: AddonType | AddonsEntity = this.addons.filter((a) => a.name == details.addon)[0];
        if (details.addon === 'BentoBox') addon = this.configConstructor.addons.filter((a) => a.name === 'BentoBox')[0];
        try {
            release = await this.octokit.rest.repos.getReleaseByTag({
                owner: addon.github.split('/')[0],
                repo: addon.github.split('/')[1],
                tag: details.version,
            });
        } catch (e) {
            return;
        }

        const releaseFiles = await this.octokit.rest.repos.listReleaseAssets({
            owner: addon.github.split('/')[0],
            repo: addon.github.split('/')[1],
            release_id: release.data.id,
        });

        let assetURL;
        if (releaseFiles.data.length === 0) {
            return;
        } else if (releaseFiles.data.length === 1) {
            assetURL = releaseFiles.data[0];
        } else {
            for (let i = 0; i < releaseFiles.data.length; i++) {
                if (
                    !releaseFiles.data[i].name
                        .toLowerCase()
                        .match(`[a-zA-Z]{3,20}-[0-9.]{1,10}(?:-snapshot-b[0-9]{0,20})?.jar`)
                )
                    continue;
                assetURL = releaseFiles.data[i];
            }
            if (!assetURL) return;
        }
        if (!assetURL) return;
        const asset = await this.octokit.rest.repos.getReleaseAsset({
            owner: addon.github.split('/')[0],
            repo: addon.github.split('/')[1],
            asset_id: assetURL.id,
            headers: {
                accept: 'application/octet-stream',
            },
        });
        const addonVersion = await this.oldVersionCache.findOne({
            where: {
                name: addon.name,
                version: release.data.tag_name,
            },
        });
        if (addonVersion) {
            console.log(
                "Addon Already Exists... Report This Issue. Details: { name: '" +
                    addon.name +
                    "', version: '" +
                    release.data.tag_name +
                    "' }",
            );
            await addonVersion.update({
                name: addon.name,
                release: Buffer.from(<ArrayBuffer>(<unknown>asset.data)),
                releaseId: release.data.id,
                releaseJarFile: assetURL.name,
                version: release.data.tag_name,
            });
        } else {
            await this.oldVersionCache.create({
                name: addon.name,
                release: Buffer.from(<ArrayBuffer>(<unknown>asset.data)),
                releaseId: release.data.id,
                releaseJarFile: assetURL.name,
                version: release.data.tag_name,
            });
        }
    }
}
