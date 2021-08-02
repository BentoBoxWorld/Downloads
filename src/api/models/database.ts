import { BuildOptions, BLOB, Model, Sequelize, STRING, NUMBER } from 'sequelize';

export interface DatabaseAttributes {
    name: string;
    release: Buffer;
    releaseId: string;
    releaseJarFile: string;
    ci?: Buffer;
    ciId?: string;
    ciJarFile?: string;
    lastUpdated: number;
    version: string;
}

export interface DatabaseModel extends Model<DatabaseAttributes>, DatabaseAttributes {}

export class Database extends Model<DatabaseModel, DatabaseAttributes> {}

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
        releaseId: STRING,
        releaseJarFile: STRING,
        ci: BLOB,
        ciId: STRING,
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
