import { BLOB, BuildOptions, Model, NUMBER, Sequelize, STRING } from 'sequelize';

interface DatabaseAttributes {
    name: string;
    release: Buffer;
    releaseId: number;
    releaseJarFile: string;
    ci?: Buffer;
    ciId?: number;
    ciJarFile?: string;
    lastUpdated: number;
    version: string;
}

export interface DatabaseModel extends Model<DatabaseAttributes>, DatabaseAttributes {}

export type DatabaseStatic = typeof Model & {
    new (values?: Record<string, unknown>, options?: BuildOptions): DatabaseModel;
};

export function DatabaseFactory(sequelize: Sequelize): DatabaseStatic {
    return <DatabaseStatic>sequelize.define('jarfiles', {
        name: {
            type: STRING,
            unique: true,
            primaryKey: true,
        },
        release: BLOB,
        releaseId: NUMBER,
        releaseJarFile: STRING,
        ci: BLOB,
        ciId: NUMBER,
        ciJarFile: STRING,
        lastUpdated: NUMBER,
        version: STRING,
    });
}

export interface DownloadCountAttributes {
    name: string;
    downloads: number;
}

export interface DownloadCountModel extends Model<DownloadCountAttributes>, DownloadCountAttributes {}

export class DownloadCount extends Model<DownloadCountModel, DownloadCountAttributes> {}

export type DownloadCountStatic = typeof Model & {
    new (values?: Record<string, unknown>, options?: BuildOptions): DownloadCountModel;
};

export function DownloadCountFactory(sequelize: Sequelize): DownloadCountStatic {
    return <DownloadCountStatic>sequelize.define('downloads', {
        name: {
            type: STRING,
            unique: true,
            primaryKey: true,
        },
        downloads: NUMBER,
    });
}

export interface OldVersionAttributes {
    name: string;
    release: Buffer;
    releaseId: number;
    releaseJarFile: string;
    version: string;
}

export interface OldVersionModel extends Model<OldVersionAttributes>, OldVersionAttributes {}

export type OldVersionStatic = typeof Model & {
    new (values?: Record<string, unknown>, options?: BuildOptions): OldVersionModel;
};

export function OldVersionFactory(sequelize: Sequelize): OldVersionStatic {
    return <OldVersionStatic>sequelize.define('oldversions', {
        name: STRING,
        release: BLOB,
        releaseId: NUMBER,
        releaseJarFile: {
            type: STRING,
            unique: true,
        },
        version: STRING,
    });
}
