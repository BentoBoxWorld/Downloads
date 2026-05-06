import { BuildOptions, Model, Sequelize, STRING, INTEGER, TEXT } from 'sequelize';

// ----- Post -----

export type PostStatus = 'draft' | 'published' | 'scheduled';

export interface PostAttributes {
    id: number;
    slug: string;                      // unique, URL-safe
    title: string;
    summary: string;                   // plain-text excerpt
    bodyMd: string;                    // markdown source (canonical)
    bodyHtml: string;                  // sanitized HTML, regenerated on save
    coverImage: string | null;         // /blog/images/... path
    authorId: string;                  // -> users.id (Discord)
    status: PostStatus;
    publishedAt: number | null;        // ms epoch, null while draft
    createdAt: number;
    updatedAt: number;
    viewCount: number;
    tagsJson: string;                  // JSON array of tag slugs
}

export interface PostModel extends Model<PostAttributes>, PostAttributes {}

export type PostStatic = typeof Model & {
    new (values?: Record<string, unknown>, options?: BuildOptions): PostModel;
};

export function PostFactory(sequelize: Sequelize): PostStatic {
    return <PostStatic>sequelize.define(
        'posts',
        {
            id: { type: INTEGER, primaryKey: true, autoIncrement: true },
            slug: { type: STRING, allowNull: false, unique: true },
            title: { type: STRING, allowNull: false },
            summary: { type: STRING(1024), allowNull: false, defaultValue: '' },
            bodyMd: { type: TEXT, allowNull: false, defaultValue: '' },
            bodyHtml: { type: TEXT, allowNull: false, defaultValue: '' },
            coverImage: { type: STRING, allowNull: true },
            authorId: { type: STRING, allowNull: false },
            status: { type: STRING, allowNull: false, defaultValue: 'draft' },
            publishedAt: { type: INTEGER, allowNull: true },
            createdAt: { type: INTEGER, allowNull: false },
            updatedAt: { type: INTEGER, allowNull: false },
            viewCount: { type: INTEGER, allowNull: false, defaultValue: 0 },
            tagsJson: { type: TEXT, allowNull: false, defaultValue: '[]' },
        },
        {
            timestamps: false,
            indexes: [
                { fields: ['status', 'publishedAt'] },
                { fields: ['authorId'] },
            ],
        },
    );
}

// ----- PostRevision: lightweight audit trail -----
//
// One row per save. Lets us recover from accidental edits and surfaces
// "this post was edited after publish" disclosure to readers. We store
// the markdown (not the HTML) since HTML is deterministic from MD.

export interface PostRevisionAttributes {
    id: number;
    postId: number;
    title: string;
    summary: string;
    bodyMd: string;
    editorId: string;
    createdAt: number;
}

export interface PostRevisionModel extends Model<PostRevisionAttributes>, PostRevisionAttributes {}

export type PostRevisionStatic = typeof Model & {
    new (values?: Record<string, unknown>, options?: BuildOptions): PostRevisionModel;
};

export function PostRevisionFactory(sequelize: Sequelize): PostRevisionStatic {
    return <PostRevisionStatic>sequelize.define(
        'post_revisions',
        {
            id: { type: INTEGER, primaryKey: true, autoIncrement: true },
            postId: { type: INTEGER, allowNull: false },
            title: { type: STRING, allowNull: false },
            summary: { type: STRING(1024), allowNull: false, defaultValue: '' },
            bodyMd: { type: TEXT, allowNull: false, defaultValue: '' },
            editorId: { type: STRING, allowNull: false },
            createdAt: { type: INTEGER, allowNull: false },
        },
        { timestamps: false, indexes: [{ fields: ['postId'] }] },
    );
}
