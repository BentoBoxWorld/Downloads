import { BuildOptions, Model, Sequelize, STRING, INTEGER, BOOLEAN } from 'sequelize';

// ----- User -----

export interface UserAttributes {
    id: string;                       // Discord user id
    username: string;
    globalName: string | null;
    avatarHash: string | null;
    createdAt: number;                // ms epoch
    lastLoginAt: number;              // ms epoch
    acceptedTermsVersion: string | null;
    isAdmin: boolean;
}

export interface UserModel extends Model<UserAttributes>, UserAttributes {}

export type UserStatic = typeof Model & {
    new (values?: Record<string, unknown>, options?: BuildOptions): UserModel;
};

export function UserFactory(sequelize: Sequelize): UserStatic {
    return <UserStatic>sequelize.define(
        'users',
        {
            id: { type: STRING, primaryKey: true },
            username: STRING,
            globalName: STRING,
            avatarHash: STRING,
            createdAt: INTEGER,
            lastLoginAt: INTEGER,
            acceptedTermsVersion: STRING,
            isAdmin: { type: BOOLEAN, defaultValue: false, allowNull: false },
        },
        { timestamps: false },
    );
}

// ----- Session -----

export interface SessionAttributes {
    sessionId: string;                // 256-bit hex
    userId: string;                   // -> Users.id
    csrfToken: string;
    createdAt: number;
    lastSeenAt: number;
    expiresAt: number;
}

export interface SessionModel extends Model<SessionAttributes>, SessionAttributes {}

export type SessionStatic = typeof Model & {
    new (values?: Record<string, unknown>, options?: BuildOptions): SessionModel;
};

export function SessionFactory(sequelize: Sequelize): SessionStatic {
    return <SessionStatic>sequelize.define(
        'sessions',
        {
            sessionId: { type: STRING, primaryKey: true },
            userId: STRING,
            csrfToken: STRING,
            createdAt: INTEGER,
            lastSeenAt: INTEGER,
            expiresAt: INTEGER,
        },
        { timestamps: false, indexes: [{ fields: ['userId'] }] },
    );
}

// ----- Submission record (created when a PR is opened) -----

export interface SubmissionAttributes {
    id: number;                       // autoincrement
    userId: string;
    gameMode: string;
    name: string;
    displayName: string;
    prUrl: string;
    termsVersion: string;
    createdAt: number;
}

export interface SubmissionModel extends Model<SubmissionAttributes>, SubmissionAttributes {}

export type SubmissionStatic = typeof Model & {
    new (values?: Record<string, unknown>, options?: BuildOptions): SubmissionModel;
};

export function SubmissionFactory(sequelize: Sequelize): SubmissionStatic {
    return <SubmissionStatic>sequelize.define(
        'submissions',
        {
            id: { type: INTEGER, primaryKey: true, autoIncrement: true },
            userId: STRING,
            gameMode: STRING,
            name: STRING,
            displayName: STRING,
            prUrl: STRING,
            termsVersion: STRING,
            createdAt: INTEGER,
        },
        { timestamps: false, indexes: [{ fields: ['userId'] }] },
    );
}
