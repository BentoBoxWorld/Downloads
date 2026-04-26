import React, { useEffect, useState } from 'react';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashAlt, faUser, faPlus } from '@fortawesome/free-solid-svg-icons';
import {
    AdminUser,
    GetAdminUsers,
    PostSetAdmin,
    SessionUser,
} from '../../ApiRequestManager';

const DISCORD_ID_RE = /^[0-9]{15,25}$/;

export default function AdminsTab({ user }: { user: SessionUser }) {
    const [admins, setAdmins] = useState<AdminUser[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [newId, setNewId] = useState('');

    function refresh() {
        setError(null);
        GetAdminUsers()
            .then(setAdmins)
            .catch((err) => setError(err.message ?? 'Failed to load admins.'));
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
            await PostSetAdmin(user.csrfToken, id, true);
            setNewId('');
            refresh();
        } catch (err) {
            setError(extractError(err) ?? 'Failed to add admin.');
        } finally {
            setBusy(false);
        }
    }

    async function handleRemove(id: string) {
        if (id === user.id) return;
        setError(null);
        setBusy(true);
        try {
            await PostSetAdmin(user.csrfToken, id, false);
            refresh();
        } catch (err) {
            setError(extractError(err) ?? 'Failed to remove admin.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div>
            <h3 css={tw`text-lg font-semibold mb-1`}>Admins</h3>
            <p css={tw`text-sm text-gray-600 mb-4`}>
                Promote or demote admins by Discord user ID. You can&rsquo;t demote yourself.
            </p>

            {admins === null && !error && (
                <div css={tw`text-sm text-gray-500`}>Loading&hellip;</div>
            )}

            {admins && (
                <div css={tw`space-y-2 mb-6`}>
                    {admins.length === 0 && (
                        <div css={tw`text-sm text-gray-500`}>No admins. (You should be here!)</div>
                    )}
                    {admins.map((a) => {
                        const isSelf = a.id === user.id;
                        const stub = a.lastLoginAt === 0;
                        return (
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
                                    <div css={tw`font-medium`}>
                                        {a.globalName || a.username || (
                                            <span css={tw`text-gray-500 italic`}>
                                                pending first login
                                            </span>
                                        )}
                                        {isSelf && (
                                            <span css={tw`ml-2 text-xs text-gray-500`}>(you)</span>
                                        )}
                                    </div>
                                    <div
                                        css={tw`text-xs text-gray-500`}
                                        style={{ fontFamily: 'var(--bb-mono)' }}
                                    >
                                        {a.id}
                                        {' · '}
                                        {stub
                                            ? 'pre-granted, never logged in'
                                            : `last seen ${new Date(a.lastLoginAt).toLocaleDateString()}`}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemove(a.id)}
                                    disabled={isSelf || busy}
                                    css={[
                                        tw`px-2 py-1 rounded text-sm flex items-center gap-1`,
                                        isSelf
                                            ? tw`text-gray-400 cursor-not-allowed`
                                            : tw`text-red-700 hover:bg-red-50`,
                                    ]}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: isSelf ? 'not-allowed' : 'pointer',
                                    }}
                                    title={isSelf ? 'You cannot demote yourself.' : 'Remove admin'}
                                >
                                    <FontAwesomeIcon icon={faTrashAlt} />
                                    Remove
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            <div css={tw`bg-gray-50 border border-gray-200 rounded p-4`}>
                <h4 css={tw`font-semibold mb-2 text-sm`}>Add admin by Discord ID</h4>
                <p css={tw`text-xs text-gray-600 mb-3`}>
                    Enter the Discord user ID of someone you want to promote. They don&rsquo;t need
                    to have logged in yet — when they next sign in with Discord, they&rsquo;ll have
                    admin access immediately.
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
                        Add admin
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

function extractError(err: unknown): string | null {
    const e = err as { response?: { data?: { error?: string } }; message?: string };
    const code = e.response?.data?.error;
    if (code === 'cannot_demote_self') return 'You cannot demote yourself.';
    if (code === 'invalid_discord_id') return 'That doesn’t look like a valid Discord ID.';
    if (code === 'forbidden') return 'You are not authorized to manage admins.';
    return e.message ?? null;
}
