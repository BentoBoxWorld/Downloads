import { Sequelize } from 'sequelize';
import { AddonsEntity, ConfigObject, PresetsEntity } from '../config';
import {
    ConfigAuditFactory,
    ConfigAuditModel,
    ConfigAuditStatic,
    ConfigOverrideFactory,
    ConfigOverrideStatic,
} from './models/configStore';

export type ConfigScope = 'addons' | 'presets';

const SCOPES: ConfigScope[] = ['addons', 'presets'];

export class ConfigStore {
    private overrides = new Map<ConfigScope, AddonsEntity[] | PresetsEntity[]>();
    private overrideModel: ConfigOverrideStatic;
    private auditModel: ConfigAuditStatic;
    readonly ready: Promise<void>;

    constructor(private readonly baseConfig: ConfigObject, sequelize: Sequelize) {
        this.overrideModel = ConfigOverrideFactory(sequelize);
        this.auditModel = ConfigAuditFactory(sequelize);
        this.ready = this.init();
    }

    private async init(): Promise<void> {
        await this.overrideModel.sync();
        await this.auditModel.sync();
        const rows = await this.overrideModel.findAll();
        for (const row of rows) {
            if (!isScope(row.scope)) continue;
            try {
                this.overrides.set(row.scope, JSON.parse(row.body));
            } catch (err) {
                console.error(`[configStore] invalid JSON in override "${row.scope}":`, (err as Error).message);
            }
        }
    }

    getEffectiveConfig(): ConfigObject {
        return {
            addons: (this.overrides.get('addons') as AddonsEntity[] | undefined) ?? this.baseConfig.addons,
            presets: (this.overrides.get('presets') as PresetsEntity[] | undefined) ?? this.baseConfig.presets,
        };
    }

    async setOverride(
        scope: ConfigScope,
        body: AddonsEntity[] | PresetsEntity[],
        userId: string,
        summary: string,
    ): Promise<void> {
        const now = Date.now();
        await this.overrideModel.upsert({
            scope,
            body: JSON.stringify(body),
            updatedBy: userId,
            updatedAt: now,
        });
        this.overrides.set(scope, body);
        await this.auditModel.create({
            scope,
            userId,
            at: now,
            summary,
        } as never);
    }

    async clearOverride(scope: ConfigScope, userId: string): Promise<void> {
        await this.overrideModel.destroy({ where: { scope } });
        this.overrides.delete(scope);
        await this.auditModel.create({
            scope,
            userId,
            at: Date.now(),
            summary: `reset ${scope} to baseline`,
        } as never);
    }

    async getAuditLog(limit = 50): Promise<ConfigAuditModel[]> {
        return this.auditModel.findAll({ order: [['at', 'DESC']], limit });
    }

    async listOverrides(): Promise<
        Array<{ scope: ConfigScope; updatedBy: string; updatedAt: number }>
    > {
        const rows = await this.overrideModel.findAll();
        const out: Array<{ scope: ConfigScope; updatedBy: string; updatedAt: number }> = [];
        for (const r of rows) {
            if (!isScope(r.scope)) continue;
            out.push({
                scope: r.scope,
                updatedBy: r.updatedBy,
                updatedAt: r.updatedAt,
            });
        }
        return out;
    }
}

function isScope(s: string): s is ConfigScope {
    return (SCOPES as string[]).includes(s);
}
