import { BuildOptions, Model, Sequelize, STRING, INTEGER, TEXT } from 'sequelize';

// ----- ConfigOverride: one row per scope (e.g. 'presets', 'addons'). -----
// `body` is the JSON-stringified replacement for that scope of config.json.

export interface ConfigOverrideAttributes {
    scope: string;
    body: string;
    updatedBy: string;
    updatedAt: number;
}

export interface ConfigOverrideModel extends Model<ConfigOverrideAttributes>, ConfigOverrideAttributes {}

export type ConfigOverrideStatic = typeof Model & {
    new (values?: Record<string, unknown>, options?: BuildOptions): ConfigOverrideModel;
};

export function ConfigOverrideFactory(sequelize: Sequelize): ConfigOverrideStatic {
    return <ConfigOverrideStatic>sequelize.define(
        'configOverrides',
        {
            scope: { type: STRING, primaryKey: true },
            body: TEXT,
            updatedBy: STRING,
            updatedAt: INTEGER,
        },
        { timestamps: false },
    );
}

// ----- ConfigAudit: append-only log of admin config edits. -----

export interface ConfigAuditAttributes {
    id: number;
    scope: string;
    userId: string;
    at: number;
    summary: string;
}

export interface ConfigAuditModel extends Model<ConfigAuditAttributes>, ConfigAuditAttributes {}

export type ConfigAuditStatic = typeof Model & {
    new (values?: Record<string, unknown>, options?: BuildOptions): ConfigAuditModel;
};

export function ConfigAuditFactory(sequelize: Sequelize): ConfigAuditStatic {
    return <ConfigAuditStatic>sequelize.define(
        'configAudits',
        {
            id: { type: INTEGER, primaryKey: true, autoIncrement: true },
            scope: STRING,
            userId: STRING,
            at: INTEGER,
            summary: STRING,
        },
        { timestamps: false, indexes: [{ fields: ['at'] }] },
    );
}
