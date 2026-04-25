import React, { useEffect, useMemo, useState } from 'react';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDiscord } from '@fortawesome/free-brands-svg-icons';
import { faSignOutAlt, faUpload } from '@fortawesome/free-solid-svg-icons';
import {
    GetBlueprints,
    GetMe,
    PostLogout,
    PostSubmitBlueprint,
    SessionUser,
    SubmitError,
} from '../ApiRequestManager';
import { BlueprintCatalog } from '../../config';

const NAME_REGEX = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

export default function SubmitPage() {
    const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
    const [catalog, setCatalog] = useState<BlueprintCatalog | null>(null);

    useEffect(() => {
        GetMe()
            .then(setUser)
            .catch(() => setUser(null));
        GetBlueprints()
            .then(setCatalog)
            .catch(() => setCatalog(null));
    }, []);

    if (user === undefined) {
        return <div css={tw`text-center my-12 text-gray-500`}>Loading...</div>;
    }
    if (user === null) {
        return <LoginGate />;
    }
    return <SubmitForm user={user} catalog={catalog} onLogout={() => setUser(null)} />;
}

function LoginGate() {
    return (
        <div css={tw`text-center my-12`}>
            <p css={tw`text-2xl font-semibold mb-4`}>Submit a Blueprint</p>
            <p css={tw`text-gray-700 mb-6 max-w-xl mx-auto`}>
                Sign in with Discord to submit a blueprint. Your submission becomes a pull request on the BentoBoxWorld
                weblink repo for review. By submitting, you agree to our&nbsp;
                <a href="/terms" css={tw`text-blue-700 underline`}>
                    Terms
                </a>
                &nbsp;and&nbsp;
                <a href="/privacy" css={tw`text-blue-700 underline`}>
                    Privacy Policy
                </a>
                .
            </p>
            <a
                href="/api/auth/discord/login"
                css={tw`inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-lg font-semibold`}
            >
                <FontAwesomeIcon icon={faDiscord} />
                &nbsp;Login with Discord
            </a>
        </div>
    );
}

function SubmitForm({
    user,
    catalog,
    onLogout,
}: {
    user: SessionUser;
    catalog: BlueprintCatalog | null;
    onLogout: () => void;
}) {
    const gameModeOptions = useMemo(() => {
        const fromCatalog = catalog
            ? [
                  ...new Set([
                      ...Object.keys(catalog.gameModes || {}),
                      ...catalog.blueprints.map((b) => b.gameMode),
                  ]),
              ]
            : [];
        return fromCatalog.sort();
    }, [catalog]);

    const [gameMode, setGameMode] = useState('');
    const [name, setName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [accepted, setAccepted] = useState(false);
    const [busy, setBusy] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<SubmitError | null>(null);

    async function handleLogout() {
        try {
            await PostLogout(user.csrfToken);
        } finally {
            onLogout();
        }
    }

    function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
        setName(e.target.value);
    }

    const nameValid = NAME_REGEX.test(name);
    const canSubmit =
        !busy && !!gameMode && nameValid && !!displayName && !!file && accepted;

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!file || !canSubmit) return;
        setBusy(true);
        setError(null);
        setSuccess(null);
        try {
            const result = await PostSubmitBlueprint(
                user.csrfToken,
                { gameMode, name, displayName, description, tags },
                file,
            );
            setSuccess(result.prUrl);
        } catch (err) {
            const e = err as { response?: { data?: SubmitError } };
            setError(e.response?.data || { error: 'unknown', reason: 'Could not submit. Please try again.' });
        } finally {
            setBusy(false);
        }
    }

    return (
        <div>
            <div css={tw`flex items-center justify-between mb-4`}>
                <p css={tw`text-2xl font-semibold`}>Submit a Blueprint</p>
                <div css={tw`flex items-center gap-3`}>
                    {user.avatarUrl && (
                        <img src={user.avatarUrl} alt="" css={tw`w-8 h-8 rounded-full`} />
                    )}
                    <span css={tw`text-sm`}>{user.globalName || user.username}</span>
                    <button
                        type="button"
                        onClick={handleLogout}
                        css={tw`text-sm text-gray-600 hover:text-gray-900`}
                        title="Log out"
                    >
                        <FontAwesomeIcon icon={faSignOutAlt} />
                    </button>
                </div>
            </div>

            {success && (
                <div css={tw`bg-green-100 border border-green-300 rounded p-3 mb-4`}>
                    Submitted. Pull request opened:&nbsp;
                    <a href={success} target="_blank" rel="noreferrer" css={tw`text-blue-700 underline`}>
                        {success}
                    </a>
                    <p css={tw`text-sm text-gray-700 mt-1`}>
                        A maintainer will review and merge it. Thank you!
                    </p>
                </div>
            )}

            {error && (
                <div css={tw`bg-red-100 border border-red-300 rounded p-3 mb-4 text-sm`}>
                    <div css={tw`font-semibold`}>Submission rejected: {error.error}</div>
                    {error.reason && <div>{error.reason}</div>}
                    {error.issues && (
                        <ul css={tw`list-disc ml-5 mt-1`}>
                            {error.issues.map((i, idx) => (
                                <li key={idx}>{i}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <form onSubmit={submit} css={tw`space-y-3`}>
                <Field label="Game mode">
                    <select
                        value={gameMode}
                        onChange={(e) => setGameMode(e.target.value)}
                        css={tw`w-full border rounded p-1`}
                    >
                        <option value="">— select —</option>
                        {gameModeOptions.map((gm) => (
                            <option key={gm} value={gm}>
                                {catalog?.gameModes[gm]?.displayName || gm}
                            </option>
                        ))}
                    </select>
                </Field>

                <Field
                    label="Name (filename slug)"
                    hint="Letters, digits, dashes, dots, underscores. 1–64 chars. Used as the .blueprint filename."
                >
                    <input
                        type="text"
                        value={name}
                        onChange={handleNameChange}
                        css={tw`w-full border rounded p-1 font-mono`}
                        placeholder="cherry-grove"
                    />
                    {!nameValid && name.length > 0 && (
                        <div css={tw`text-xs text-red-600 mt-1`}>
                            Must match {`/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/`}
                        </div>
                    )}
                </Field>

                <Field label="Display name">
                    <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        css={tw`w-full border rounded p-1`}
                        placeholder="Cherry Grove Island"
                    />
                </Field>

                <Field label="Description (one line per row, max 10)">
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        css={tw`w-full border rounded p-1 h-20`}
                        placeholder="A pink-blossomed cherry-grove starter island."
                    />
                </Field>

                <Field label="Tags (comma-separated, lowercase)">
                    <input
                        type="text"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        css={tw`w-full border rounded p-1`}
                        placeholder="starter, overworld"
                    />
                </Field>

                <Field label="Blueprint file (.blueprint, max 5 MB)">
                    <input
                        type="file"
                        accept=".blueprint,application/json"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                </Field>

                <label css={tw`block text-sm`}>
                    <input
                        type="checkbox"
                        checked={accepted}
                        onChange={(e) => setAccepted(e.target.checked)}
                        css={tw`mr-2`}
                    />
                    I have read and accept the&nbsp;
                    <a href="/terms" target="_blank" rel="noreferrer" css={tw`text-blue-700 underline`}>
                        Terms
                    </a>
                    &nbsp;and&nbsp;
                    <a href="/privacy" target="_blank" rel="noreferrer" css={tw`text-blue-700 underline`}>
                        Privacy Policy
                    </a>
                    .
                </label>

                <button
                    type="submit"
                    disabled={!canSubmit}
                    css={`
                        ${tw`px-4 py-2 rounded font-semibold text-white`}
                        ${canSubmit ? tw`bg-blue-600 hover:bg-blue-700` : tw`bg-gray-300 cursor-not-allowed`}
                    `}
                >
                    <FontAwesomeIcon icon={faUpload} />
                    &nbsp;{busy ? 'Submitting…' : 'Submit'}
                </button>
            </form>
        </div>
    );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <label css={tw`block text-sm font-semibold mb-1`}>{label}</label>
            {children}
            {hint && <div css={tw`text-xs text-gray-500 mt-1`}>{hint}</div>}
        </div>
    );
}
