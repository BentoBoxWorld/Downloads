import { BuildOptions, INTEGER, Model, Sequelize, STRING } from 'sequelize';

/**
 * One row per (UTC day, metric, key). `key` is '' for ecosystem-wide metrics
 * (servers, players, islands...) and the addon/game-mode name for per-addon
 * metrics. Rows are only ever raised, never lowered, within a day — see
 * StatsManager.upsertMax().
 */
export interface SnapshotAttributes {
    day: string; // YYYY-MM-DD (UTC)
    metric: string;
    key: string;
    value: number;
}

export interface SnapshotModel extends Model<SnapshotAttributes>, SnapshotAttributes {}

export type SnapshotStatic = typeof Model &
    (new (values?: Record<string, unknown>, options?: BuildOptions) => SnapshotModel);

export function SnapshotFactory(sequelize: Sequelize): SnapshotStatic {
    return <SnapshotStatic>sequelize.define(
        'snapshots',
        {
            day: { type: STRING(10), allowNull: false },
            metric: { type: STRING(32), allowNull: false },
            key: { type: STRING(64), allowNull: false, defaultValue: '' },
            value: { type: INTEGER, allowNull: false },
        },
        {
            timestamps: false,
            indexes: [{ unique: true, fields: ['day', 'metric', 'key'] }, { fields: ['metric', 'key', 'day'] }],
        },
    );
}
