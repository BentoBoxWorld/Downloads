import React, { useEffect, useMemo, useRef, useState } from 'react';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDiscord } from '@fortawesome/free-brands-svg-icons';
import {
    faSignOutAlt,
    faUpload,
    faCheckCircle,
    faExchangeAlt,
} from '@fortawesome/free-solid-svg-icons';
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
const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface ParsedBlueprint {
    name?: string;
    displayName?: string;
    description?: string[];
    icon?: string;
    xSize?: number;
    ySize?: number;
    zSize?: number;
    sink?: boolean;
    blocks?: unknown[];
    attached?: unknown[];
    entities?: unknown[];
}

interface DroppedFile {
    file: File;
    json: ParsedBlueprint;
    derivedSlug: string;
}

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

    const [dropped, setDropped] = useState<DroppedFile | null>(null);
    const [dropError, setDropError] = useState<string | null>(null);

    // Form fields. Re-seeded from the dropped file each time it changes.
    const [gameMode, setGameMode] = useState('');
    const [name, setName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
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

    async function acceptFile(file: File) {
        setDropError(null);
        if (!file.name.toLowerCase().endsWith('.blueprint')) {
            setDropError(`File must end in .blueprint (got "${file.name}").`);
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            setDropError(
                `File is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
            );
            return;
        }
        let json: ParsedBlueprint;
        try {
            const text = await file.text();
            json = JSON.parse(text);
        } catch {
            setDropError('File is not valid JSON.');
            return;
        }
        if (
            typeof json !== 'object' ||
            json === null ||
            !Number.isFinite(json.xSize) ||
            !Number.isFinite(json.ySize) ||
            !Number.isFinite(json.zSize) ||
            !Array.isArray(json.blocks)
        ) {
            setDropError("That doesn't look like a blueprint (missing xSize/ySize/zSize or blocks).");
            return;
        }
        const slug = deriveSlug(file.name);
        setDropped({ file, json, derivedSlug: slug });
        // Pre-fill fields. Only overwrite blank fields so user edits survive.
        setName((cur) => cur || slug);
        setDisplayName((cur) => cur || json.displayName || json.name || slug);
        if (Array.isArray(json.description) && json.description.length) {
            setDescription((cur) => cur || json.description!.join('\n'));
        }
    }

    function clearFile() {
        setDropped(null);
        setDropError(null);
    }

    const nameValid = NAME_REGEX.test(name);
    const canSubmit = !busy && !!gameMode && nameValid && !!displayName && !!dropped && accepted;

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!dropped || !canSubmit) return;
        setBusy(true);
        setError(null);
        setSuccess(null);
        try {
            const result = await PostSubmitBlueprint(
                user.csrfToken,
                { gameMode, name, displayName, description, tags },
                dropped.file,
            );
            setSuccess(result.prUrl);
        } catch (err) {
            const e = err as { response?: { data?: SubmitError } };
            setError(
                e.response?.data || {
                    error: 'unknown',
                    reason: 'Could not submit. Please try again.',
                },
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <div>
            <div css={tw`flex items-center justify-between mb-4`}>
                <p css={tw`text-2xl font-semibold`}>Submit a Blueprint</p>
                <div css={tw`flex items-center gap-3`}>
                    {user.avatarUrl && <img src={user.avatarUrl} alt="" css={tw`w-8 h-8 rounded-full`} />}
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
                    <p css={tw`text-sm text-gray-700 mt-1`}>A maintainer will review and merge it. Thank you!</p>
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

            {!dropped ? (
                <DropZone onAccept={acceptFile} error={dropError} />
            ) : (
                <FilePreview dropped={dropped} onReplace={clearFile} />
            )}

            {dropped && (
                <form onSubmit={submit} css={tw`space-y-3 mt-6`}>
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
                        hint="Letters, digits, dashes, dots, underscores. 1–64 chars."
                    >
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            css={tw`w-full border rounded p-1 font-mono`}
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
                        />
                    </Field>

                    <Field label="Description (one line per row, max 10)">
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            css={tw`w-full border rounded p-1 h-20`}
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
            )}
        </div>
    );
}

function DropZone({ onAccept, error }: { onAccept: (f: File) => void; error: string | null }) {
    const [hover, setHover] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);

    function onDrop(e: React.DragEvent) {
        e.preventDefault();
        setHover(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onAccept(file);
    }

    return (
        <div>
            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    setHover(true);
                }}
                onDragLeave={() => setHover(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                css={`
                    ${tw`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition`}
                    ${hover ? tw`border-blue-500 bg-blue-50` : tw`border-gray-300 bg-gray-50 hover:border-gray-400`}
                `}
            >
                <FontAwesomeIcon icon={faUpload} size="2x" css={tw`text-gray-400 mb-2`} />
                <p css={tw`text-lg font-semibold`}>Drop a .blueprint file here</p>
                <p css={tw`text-sm text-gray-600`}>or click to browse — max 5 MB</p>
                <input
                    ref={inputRef}
                    type="file"
                    accept=".blueprint"
                    css={tw`hidden`}
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onAccept(file);
                        e.target.value = '';
                    }}
                />
            </div>
            {error && (
                <div css={tw`mt-2 bg-red-100 border border-red-300 rounded p-2 text-sm text-red-800`}>{error}</div>
            )}
        </div>
    );
}

function FilePreview({ dropped, onReplace }: { dropped: DroppedFile; onReplace: () => void }) {
    const j = dropped.json;
    const blocks = Array.isArray(j.blocks) ? j.blocks.length : 0;
    const attached = Array.isArray(j.attached) ? j.attached.length : 0;
    const entities = Array.isArray(j.entities)
        ? j.entities.reduce((sum, pair) => {
              const list = Array.isArray(pair) ? pair[1] : null;
              return sum + (Array.isArray(list) ? list.length : 0);
          }, 0)
        : 0;
    return (
        <div css={tw`bg-green-50 border border-green-200 rounded-lg p-4 flex gap-4 items-start`}>
            <FontAwesomeIcon icon={faCheckCircle} css={tw`text-green-600 mt-1`} size="lg" />
            <div css={tw`flex-1`}>
                <div css={tw`font-semibold`}>{dropped.file.name}</div>
                <div css={tw`text-xs text-gray-600 mb-2`}>
                    {(dropped.file.size / 1024).toFixed(1)} KB · {j.xSize ?? '?'}×{j.ySize ?? '?'}×{j.zSize ?? '?'}
                    &nbsp;· blocks: {blocks.toLocaleString()}
                    {attached > 0 && <> · attached: {attached.toLocaleString()}</>}
                    {entities > 0 && <> · entities: {entities.toLocaleString()}</>}
                    {j.sink && <> · sinking</>}
                </div>
                <div css={tw`text-xs text-gray-500`}>
                    Filename slug: <code>{dropped.derivedSlug}</code>
                    {j.displayName && (
                        <>
                            &nbsp;· displayName from file: <em>{j.displayName}</em>
                        </>
                    )}
                </div>
            </div>
            <button
                type="button"
                onClick={onReplace}
                css={tw`text-sm text-blue-700 hover:text-blue-900 underline`}
            >
                <FontAwesomeIcon icon={faExchangeAlt} />
                &nbsp;Replace
            </button>
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

function deriveSlug(filename: string): string {
    let stem = filename.replace(/\.blueprint$/i, '');
    stem = stem.replace(/\s+/g, '-');
    stem = stem.replace(/[^A-Za-z0-9_.-]/g, '');
    stem = stem.replace(/^[._-]+/, '');
    if (stem.length === 0) stem = 'blueprint';
    if (stem.length > 64) stem = stem.slice(0, 64);
    return stem;
}
