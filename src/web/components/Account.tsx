import React, { useEffect, useState } from 'react';
import tw from 'twin.macro';
import {
    GetMe,
    GetMySubmissions,
    MySubmission,
    PostDeleteAccount,
    PostLogout,
    SessionUser,
} from '../ApiRequestManager';

export default function AccountPage() {
    const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
    const [submissions, setSubmissions] = useState<MySubmission[] | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [deleted, setDeleted] = useState(false);

    useEffect(() => {
        GetMe()
            .then((u) => {
                setUser(u);
                if (u) GetMySubmissions().then(setSubmissions).catch(() => setSubmissions([]));
            })
            .catch(() => setUser(null));
    }, []);

    if (deleted) {
        return (
            <div css={tw`text-center my-12`}>
                <p css={tw`text-2xl font-semibold mb-2`}>Account deleted</p>
                <p css={tw`text-gray-700`}>Thanks for stopping by.</p>
            </div>
        );
    }

    if (user === undefined) {
        return <div css={tw`text-center my-12 text-gray-500`}>Loading...</div>;
    }
    if (user === null) {
        return (
            <div css={tw`text-center my-12`}>
                <p css={tw`text-xl mb-2`}>You are not logged in.</p>
                <a href="/api/auth/discord/login?return=/account" css={tw`text-blue-700 underline`}>
                    Login with Discord
                </a>
            </div>
        );
    }

    async function handleLogout() {
        try {
            await PostLogout(user!.csrfToken);
        } finally {
            setUser(null);
        }
    }

    async function handleDelete() {
        setBusy(true);
        try {
            await PostDeleteAccount(user!.csrfToken);
            setDeleted(true);
            setUser(null);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div>
            <p css={tw`text-2xl font-semibold mb-4`}>Account</p>

            <div css={tw`bg-white rounded-md shadow-sm p-4 mb-4 flex items-center gap-4`}>
                {user.avatarUrl && <img src={user.avatarUrl} alt="" css={tw`w-12 h-12 rounded-full`} />}
                <div>
                    <div css={tw`font-semibold`}>{user.globalName || user.username}</div>
                    <div css={tw`text-xs text-gray-500`}>Discord ID: {user.id}</div>
                    <div css={tw`text-xs text-gray-500`}>
                        Terms accepted:{' '}
                        {user.acceptedTermsVersion
                            ? user.acceptedTermsVersion === user.currentTermsVersion
                                ? `${user.acceptedTermsVersion} (current)`
                                : `${user.acceptedTermsVersion} (out of date)`
                            : 'not yet'}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleLogout}
                    css={tw`ml-auto text-sm text-gray-600 hover:text-gray-900 underline`}
                >
                    Log out
                </button>
            </div>

            <div css={tw`bg-white rounded-md shadow-sm p-4 mb-4`}>
                <h3 css={tw`font-semibold mb-2`}>Your submissions</h3>
                {submissions === null && <div css={tw`text-sm text-gray-500`}>Loading…</div>}
                {submissions && submissions.length === 0 && (
                    <div css={tw`text-sm text-gray-500`}>No submissions yet.</div>
                )}
                {submissions && submissions.length > 0 && (
                    <ul css={tw`text-sm space-y-1`}>
                        {submissions.map((s, i) => (
                            <li key={i}>
                                <a href={s.prUrl} target="_blank" rel="noreferrer" css={tw`text-blue-700 underline`}>
                                    {s.gameMode}/{s.name}
                                </a>{' '}
                                — {s.displayName}{' '}
                                <span css={tw`text-gray-500`}>
                                    ({new Date(s.createdAt).toLocaleDateString()})
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div css={tw`bg-red-50 rounded-md border border-red-200 p-4`}>
                <h3 css={tw`font-semibold mb-2`}>Delete account</h3>
                <p css={tw`text-sm text-gray-700 mb-2`}>
                    Removes your user record, all sessions, and the local index of your submissions. Pull requests
                    already opened on weblink will not be retracted — see the{' '}
                    <a href="/privacy" css={tw`text-blue-700 underline`}>
                        Privacy Policy
                    </a>
                    .
                </p>
                {!confirming ? (
                    <button
                        type="button"
                        onClick={() => setConfirming(true)}
                        css={tw`px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 text-sm`}
                    >
                        Delete my account
                    </button>
                ) : (
                    <div css={tw`flex items-center gap-2`}>
                        <span css={tw`text-sm font-semibold`}>Are you sure?</span>
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={busy}
                            css={tw`px-3 py-1 rounded bg-red-700 text-white text-sm`}
                        >
                            Yes, delete
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirming(false)}
                            disabled={busy}
                            css={tw`px-3 py-1 rounded bg-gray-200 text-sm`}
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
