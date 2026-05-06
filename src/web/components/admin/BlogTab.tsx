import React, { useEffect, useState } from 'react';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrashAlt, faPencilAlt, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import {
    AdminBlogPost,
    DeleteAdminBlogPost,
    GetAdminBlogPosts,
    PostAdminBlogPost,
    SessionUser,
} from '../../ApiRequestManager';
import BlogEditor from './BlogEditor';

export default function BlogTab({ user }: { user: SessionUser }) {
    const [posts, setPosts] = useState<AdminBlogPost[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [creating, setCreating] = useState(false);

    function refresh() {
        setError(null);
        GetAdminBlogPosts()
            .then(setPosts)
            .catch((e) => setError(extract(e)));
    }
    useEffect(refresh, []);

    async function handleCreate() {
        const title = window.prompt('Post title?');
        if (!title || !title.trim()) return;
        setCreating(true);
        try {
            const p = await PostAdminBlogPost(user.csrfToken, { title: title.trim() });
            refresh();
            setEditingId(p.id);
        } catch (e) {
            setError(extract(e));
        } finally {
            setCreating(false);
        }
    }

    async function handleDelete(id: number, title: string) {
        if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
        try {
            await DeleteAdminBlogPost(user.csrfToken, id);
            refresh();
        } catch (e) {
            setError(extract(e));
        }
    }

    if (editingId !== null) {
        return (
            <BlogEditor
                user={user}
                postId={editingId}
                onClose={() => {
                    setEditingId(null);
                    refresh();
                }}
            />
        );
    }

    return (
        <div>
            <div css={tw`flex items-center mb-6`}>
                <h3 css={tw`text-lg font-semibold m-0`}>Blog posts</h3>
                <button
                    type="button"
                    onClick={handleCreate}
                    disabled={creating}
                    css={tw`ml-auto px-3 py-2 rounded bg-gray-900 text-white text-sm hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2`}
                    style={{ border: 'none', cursor: 'pointer' }}
                >
                    <FontAwesomeIcon icon={faPlus} />
                    New post
                </button>
            </div>

            {posts === null && !error && <div css={tw`text-sm text-gray-500`}>Loading…</div>}

            {posts && posts.length === 0 && (
                <div
                    css={tw`text-center text-gray-600 border border-dashed border-gray-300 rounded p-8`}
                >
                    No posts yet. Click <strong>New post</strong> to write your first one.
                </div>
            )}

            {posts && posts.length > 0 && (
                <div css={tw`space-y-2`}>
                    {posts.map((p) => (
                        <div
                            key={p.id}
                            css={tw`flex items-start gap-3 border border-gray-200 rounded p-3 bg-white`}
                        >
                            <div css={tw`flex-1 min-w-0`}>
                                <div css={tw`flex items-center gap-2`}>
                                    <button
                                        type="button"
                                        onClick={() => setEditingId(p.id)}
                                        css={tw`font-semibold text-left hover:underline`}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            padding: 0,
                                            cursor: 'pointer',
                                            color: 'inherit',
                                        }}
                                    >
                                        {p.title}
                                    </button>
                                    <span
                                        css={[
                                            tw`text-xs px-2 py-0.5 rounded`,
                                            p.status === 'published'
                                                ? tw`bg-green-100 text-green-800`
                                                : tw`bg-gray-200 text-gray-700`,
                                        ]}
                                    >
                                        {p.status}
                                    </span>
                                </div>
                                <div
                                    css={tw`text-xs text-gray-500 mt-1`}
                                    style={{ fontFamily: 'var(--bb-mono)' }}
                                >
                                    /p/{p.slug}
                                    {' · '}
                                    {p.status === 'published'
                                        ? `published ${new Date(p.publishedAt).toLocaleDateString()}`
                                        : `created ${new Date(p.createdAt).toLocaleDateString()}`}
                                    {' · '}
                                    {p.viewCount} views
                                </div>
                            </div>
                            {p.status === 'published' && (
                                <a
                                    href={`/blog/p/${encodeURIComponent(p.slug)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    css={tw`text-gray-600 hover:text-gray-900 px-2 py-1 text-sm`}
                                    title="View live"
                                >
                                    <FontAwesomeIcon icon={faExternalLinkAlt} />
                                </a>
                            )}
                            <button
                                type="button"
                                onClick={() => setEditingId(p.id)}
                                css={tw`text-blue-700 hover:bg-blue-50 px-2 py-1 rounded text-sm`}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                            >
                                <FontAwesomeIcon icon={faPencilAlt} /> Edit
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDelete(p.id, p.title)}
                                css={tw`text-red-700 hover:bg-red-50 px-2 py-1 rounded text-sm`}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                            >
                                <FontAwesomeIcon icon={faTrashAlt} /> Delete
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {error && (
                <div
                    css={tw`mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800`}
                >
                    {error}
                </div>
            )}
        </div>
    );
}

function extract(err: unknown): string {
    const e = err as { response?: { data?: { error?: string; reason?: string } }; message?: string };
    return e.response?.data?.reason ?? e.response?.data?.error ?? e.message ?? 'Unknown error';
}
