import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execFileP = promisify(execFile);

export interface WeblinkConfig {
    url: string;
    path: string;
    branch: string;
}

const DEFAULTS: WeblinkConfig = {
    url: 'https://github.com/BentoBoxWorld/weblink.git',
    // resolved relative to the process cwd (which is dist/ at runtime,
    // matching how config.json / thirdparty.json are read)
    path: './../data/weblink',
    branch: 'master',
};

export class WeblinkSync {
    readonly config: WeblinkConfig;
    private syncing = false;

    constructor(overrides: Partial<WeblinkConfig> = {}) {
        this.config = { ...DEFAULTS, ...overrides };
    }

    get localPath(): string {
        return path.resolve(this.config.path);
    }

    get blueprintsDir(): string {
        return path.join(this.localPath, 'blueprints');
    }

    private isRepo(): boolean {
        return fs.existsSync(path.join(this.localPath, '.git'));
    }

    async sync(): Promise<void> {
        if (this.syncing) return;
        this.syncing = true;
        try {
            if (!fs.existsSync(this.localPath)) {
                fs.mkdirSync(this.localPath, { recursive: true });
            }
            if (this.isRepo()) {
                await this.pull();
            } else {
                await this.clone();
            }
        } catch (err) {
            console.error('[weblink] sync failed:', (err as Error).message);
        } finally {
            this.syncing = false;
        }
    }

    private async clone(): Promise<void> {
        const parent = path.dirname(this.localPath);
        const target = path.basename(this.localPath);
        await execFileP(
            'git',
            ['clone', '--depth', '1', '--branch', this.config.branch, this.config.url, target],
            { cwd: parent },
        );
        console.log('[weblink] cloned', this.config.url, '→', this.localPath);
    }

    private async pull(): Promise<void> {
        await execFileP('git', ['pull', '--ff-only', '--depth', '1'], { cwd: this.localPath });
    }
}
