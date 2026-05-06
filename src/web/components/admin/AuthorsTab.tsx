import React, { useEffect, useState } from 'react';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashAlt, faUser, faPlus, faShieldAlt } from '@fortawesome/free-solid-svg-icons';
import {
    BlogAuthorRow,
    GetAdminAuthors,
    PostSetAuthor,
    SessionUser,
} from '../../ApiRequestManager';

const DISCORD_ID_RE = /^[0-9]{15,25}$/;

export default function AuthorsTab({ user }: { user: SessionUser }) {
    const [authors, setAuthors] = useState<BlogAuthorRow[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [newId, setNewId] = useState('');

    function refresh() {
        setError(null);
        GetAdminAuthors()
            .then(setAuthors)
            .catch((err) => setError(extract(err)));
    }
    useEffect(refresh, []);

    async function handleAdd() {
        const id = newId.trim();
        if (!DISCORD_ID_RE.test(id)) {
            setError('Discord ID must be 15–25 digits.');
            return;
        }
        setError(null);
        setBusy(true);
        try {
            await PostSetAuthor(user.csrfToken, id, true);
            setNewId('');
            refresh();
        } catch (err) {
            setError(extract(err));
        } finally {
            setBusy(false);
        }
    }

    async function handleRemove(id: string, isAdmin: boolean) {
        if (isAdmin) return;
        setError(null);
        setBusy(true);
        try {
            await PostSetAuthor(user.csrfToken, id, false);
            refresh();
        } catch (err) {
            setError(extract(err));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div>
            <h3 css={tw`text-lg font-semibold mb-1`}>Blog authors</h3>
            <p css={tw`text-sm text-gray-600 mb-4`}>
                Anyone listed here can write and publish blog posts. Full admins are always
                authors and can&rsquo;t be revoked from this list — demote them on the Admins
                tab instead.
            </p>

            {authors === null && !error && (
                <div css={tw`text-sm text-gray-500`}>Loading&hellip;</div>
            )}

            {authors && (
                <div css={tw`space-y-2 mb-6`}>
                    {authors.length === 0 && (
                        <div css={tw`text-sm text-gray-500`}>No authors yet.</div>
                    )}
                    {authors.map((a) => (
                        <div
                            key={a.id}
                            css={tw`flex items-center gap-3 border border-gray-200 rounded p-3 bg-white`}
                        >
                            {a.avatarUrl ? (
                                <img
                                    src={a.avatarUrl}
                                    alt=""
                                    css={tw`w-8 h-8 rounded-full flex-shrink-0`}
                                />
                            ) : (
                                <div
                                    css={tw`w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0`}
                                >
                                    <FontAwesomeIcon icon={faUser} />
                                </div>
                            )}
                            <div css={tw`flex-1 min-w-0`}>
                                <div css={tw`font-medium flex items-center gap-2`}>
                                    {a.globalName || a.username || (
                                        <span css={tw`text-gray-500 italic`}>
                                            pending first login
                                        </span>
                                    )}
                                    {a.isAdmin && (
                                        <span
                                            css={tw`text-xs bg-gray-900 text-white px-1.5 py-0.5 rounded flex items-center gap-1`}
                                        >
                                            <FontAwesomeIcon icon={faShieldAlt} /> admin
                                        </span>
                                    )}
                                </div>
                                <div
                                    css={tw`text-xs text-gray-500`}
                                    style={{ fontFamily: 'var(--bb-mono)' }}
                                >
                                    {a.id}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleRemove(a.id, a.isAdmin)}
                                disabled={a.isAdmin || busy}
                                css={[
                                    tw`px-2 py-1 rounded text-sm flex items-center gap-1`,
                                    a.isAdmin
                                        ? tw`text-gray-400 cursor-not-allowed`
                                        : tw`text-red-700 hover:bg-red-50`,
                                ]}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: a.isAdmin ? 'not-allowed' : 'pointer',
                                }}
                                title={
                                    a.isAdmin
                                        ? 'Admins are implicit authors. Demote on the Admins tab.'
                                        : 'Revoke author access'
                                }
                            >
                                <FontAwesomeIcon icon={faTrashAlt} />
                                Remove
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div css={tw`bg-gray-50 border border-gray-200 rounded p-4`}>
                <h4 css={tw`font-semibold mb-2 text-sm`}>Grant author access by Discord ID</h4>
                <p css={tw`text-xs text-gray-600 mb-3`}>
                    They don&rsquo;t need to have logged in yet — when they next sign in with
                    Discord they&rsquo;ll see the Blog tab in the admin area immediately.
                </p>
                <div css={tw`flex items-center gap-2`}>
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={newId}
                        onChange={(e) => setNewId(e.target.value)}
                        placeholder="e.g. 272498407971487744"
                        disabled={busy}
                        css={tw`flex-1 px-3 py-2 border border-gray-300 rounded text-sm`}
                        style={{ fontFamily: 'var(--bb-mono)' }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAdd();
                        }}
                    />
                    <button
                        type="button"
                        onClick={handleAdd}
                        disabled={busy || !DISCORD_ID_RE.test(newId.trim())}
                        css={tw`px-3 py-2 rounded bg-gray-900 text-white text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
                        style={{ border: 'none' }}
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        Add author
                    </button>
                </div>
            </div>

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
    const e = err as {
        response?: { data?: { error?: string; reason?: string } };
        message?: string;
    };
    const code = e.response?.data?.error;
    if (code === 'invalid_discord_id') return 'That doesn’t look like a valid Discord ID.';
    if (code === 'cannot_revoke_admin_author')
        return 'This user is a full admin — admins are implicit authors. Demote on the Admins tab.';
    if (code === 'forbidden') return 'You are not authorized to manage authors.';
    return e.response?.data?.reason ?? code ?? e.message ?? 'Unknown error';
}
