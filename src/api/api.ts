import { Request, Response } from 'express';
import { AddonsEntity, AddonType, ConfigObject } from '../config';
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
import Archiver = require('archiver');

const { throttling } = require('@octokit/plugin-throttling');

export default class ApiManager {
    config: ConfigObject;
    addons: AddonType[] = [];
    octokit: Octokit;
    jenkins: JenkinsAPI = require('jenkins')({ baseUrl: 'https://ci.codemc.io' });

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
                const addonVersions = await this.oldVersionCache.findAll({
                    where: {
                        name: oldAddonsKey,
                    },
                });
                for (const versionID in oldAddons[oldAddonsKey]) {
                    const version = addonVersions.filter((a) => {
                        return a.version === oldAddons[oldAddonsKey][versionID];
                    })[0];
                    if (!version) {
                        oldAddonList.push({ addon: oldAddonsKey, version: oldAddons[oldAddonsKey][versionID] });
                    }
                }
            }
            cron.schedule('*/6 * * * *', () => {
                this.generateDownloads();
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
        this.config = configConstructor;

        const setAddons = async () => {
            for await (const addon1 of configConstructor.addons.filter((addon) => addon.name !== 'BentoBox')) {
                const versions = {
                    latest: (await this.jarCache.findOne({ where: { name: addon1.name } }))?.version || '0',
                    beta: (await this.jarCache.findOne({ where: { name: addon1.name } }))?.ciId?.toString() || '0',
                    ...addon1.versions,
                };
                this.addons.push({
                    name: addon1.name,
                    description: addon1.description,
                    gamemode: addon1.gamemode,
                    github: addon1.github,
                    versions: versions,
                });
            }
        };

        setAddons();
    }

    async updateJenkins(addon: AddonsEntity) {
        const jenkins = this.jenkins;
        const getBase64 = this.getBase64;
        const project = addon.ci;
        const addonDatabase: DatabaseModel | null = await this.jarCache.findOne({ where: { name: addon.name } });
        if (addonDatabase === null) return;
        const latestJenkins = await this.getLatestJenkins(addon);
        if (addonDatabase.ciId && addonDatabase.ciId === latestJenkins) return;
        jenkins.build.get(project, latestJenkins, async function (err, data) {
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
            if (addonByType.length === 0) {
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
            const bentoBoxJar = bentoBoxVersions.filter(
                (a) => a.version === addons.filter((a) => a.name === 'BentoBox')[0].versions[<string>version],
            )[0];
            if (bentoBoxJar) {
                archive.append(bentoBoxJar.release, { name: bentoBoxJar.releaseJarFile });
            }
        }
        for (const addon of addons) {
            if (typeof version !== 'string') version = 'latest';
            if (version === 'beta') {
                const addonJar: DatabaseModel | null = await this.jarCache.findOne({ where: { name: addon.name } });
                if (addonJar) {
                    if (addonJar.ci && addonJar.ciJarFile) {
                        archive.append(addonJar.ci, { name: 'addons/' + addonJar.ciJarFile });
                    }
                }
            } else if (version === 'latest') {
                const addonJar: DatabaseModel | null = await this.jarCache.findOne({ where: { name: addon.name } });
                if (addonJar) {
                    archive.append(addonJar.release, { name: 'addons/' + addonJar.releaseJarFile });
                }
            } else {
                const addonVersions = await this.oldVersionCache.findAll({
                    where: {
                        name: addon.name,
                    },
                });
                const addonJar = addonVersions.filter((a) => a.version === addon.versions[<string>version])[0];
                if (addonJar) {
                    archive.append(addonJar.release, { name: 'addons/' + addonJar.releaseJarFile });
                }
            }
        }
        await archive.finalize();

        for (const addon of addons) {
            await this.updateDownloadCount(addon.name);
        }
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
            throw e;
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
        await this.oldVersionCache.create({
            name: addon.name,
            release: Buffer.from(<ArrayBuffer>(<unknown>asset.data)),
            releaseId: release.data.id,
            releaseJarFile: assetURL.name,
            version: release.data.tag_name,
        });
    }
}
