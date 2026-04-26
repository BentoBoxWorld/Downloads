import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDiscord, faGithub } from '@fortawesome/free-brands-svg-icons';
import {
    faSignOutAlt,
    faUpload,
    faCheck,
    faArrowRight,
    faExternalLinkAlt,
    faTimes,
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
import { takePendingBlueprint } from '../pendingBlueprint';
import VoxelStack, {
    BlueprintVoxels,
    deriveVoxels,
    RealVoxel,
    variantFor,
    Variant,
} from './VoxelStack';

const NAME_REGEX = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_TAGS = 6;
const MAX_DESCRIPTION_LINES = 10;
const SUGGESTED_TAGS = [
    'overworld',
    'nether',
    'end',
    'tree',
    'tower',
    'cave',
    'underwater',
    'starter',
    'small',
    'large',
    'sinking',
];

/* Default swatches when the catalog overlay doesn't supply one. Same hexes
 * the design prototype used. */
const GM_SWATCH: Record<string, string> = {
    BSkyBlock: '#cfe7d4',
    AcidIsland: '#a8d6ee',
    AOneBlock: '#e8d49e',
    CaveBlock: '#a09689',
    Boxed: '#bfa6c9',
    Poseidon: '#7fb3cc',
    SkyGrid: '#cfe7f2',
    Brix: '#e8b34a',
    Parkour: '#ffdd57',
};

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

interface ParsedSummary {
    dim: { x: number; y: number; z: number };
    blocks: number;
    entities: number;
    biome: string;
    sinking: boolean;
    topBlocks: { material: string; count: number }[];
}

/* ── Helpers ───────────────────────────────────────────────────── */

function humanSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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

function countEntities(entities: unknown[] | undefined): number {
    if (!Array.isArray(entities)) return 0;
    return entities.reduce((sum: number, pair) => {
        const list = Array.isArray(pair) ? (pair as unknown[])[1] : null;
        return sum + (Array.isArray(list) ? list.length : 0);
    }, 0);
}

/* The blueprint file format pairs each occupied position with a
 *   { blockData: 'minecraft:oak_planks[axis=y]', biome?: string }
 * record. Walk the list, strip block-state suffixes, count materials. */
function summarizeBlueprint(json: ParsedBlueprint): ParsedSummary {
    const blocks = Array.isArray(json.blocks) ? json.blocks : [];
    const matCounts: Record<string, number> = {};
    const biomeCounts: Record<string, number> = {};
    for (const entry of blocks) {
        if (!Array.isArray(entry) || entry.length < 2) continue;
        const block = entry[1] as { blockData?: string; biome?: string } | null;
        if (!block) continue;
        if (typeof block.blockData === 'string') {
            const mat = block.blockData.split('[')[0];
            matCounts[mat] = (matCounts[mat] || 0) + 1;
        }
        if (typeof block.biome === 'string') {
            biomeCounts[block.biome] = (biomeCounts[block.biome] || 0) + 1;
        }
    }
    const topBlocks = Object.entries(matCounts)
        .map(([material, count]) => ({ material, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    const topBiome = Object.entries(biomeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return {
        dim: {
            x: Number.isFinite(json.xSize) ? (json.xSize as number) : 0,
            y: Number.isFinite(json.ySize) ? (json.ySize as number) : 0,
            z: Number.isFinite(json.zSize) ? (json.zSize as number) : 0,
        },
        blocks: blocks.length,
        entities: countEntities(json.entities),
        biome: topBiome ? topBiome.replace(/^minecraft:/, '') : '—',
        sinking: !!json.sink,
        topBlocks,
    };
}

function swatchForGameMode(gm: string, catalog: BlueprintCatalog | null): string {
    const overlay = catalog?.gameModes?.[gm]?.color;
    if (overlay) return overlay;
    return GM_SWATCH[gm] || '#7fb3cc';
}

/* ── Page entry: auth gate ─────────────────────────────────────── */

export default function SubmitPage(): JSX.Element {
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

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bp-paper-2)' }}>
            {user === undefined ? (
                <Loading />
            ) : user === null ? (
                <LoginGate />
            ) : (
                <SubmitForm
                    user={user}
                    catalog={catalog}
                    onLogout={() => setUser(null)}
                />
            )}
        </div>
    );
}

function Loading(): JSX.Element {
    return (
        <div
            style={{
                padding: '120px 20px',
                textAlign: 'center',
                color: 'var(--bp-ink-soft)',
                fontFamily: 'var(--bb-mono)',
                fontSize: 13,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
            }}
        >
            Loading…
        </div>
    );
}

function LoginGate(): JSX.Element {
    return (
        <>
            <SubmitHero step={1} hasFile={false} signedIn={false} />
            <section style={{ padding: '24px 28px 80px' }}>
                <div
                    style={{
                        maxWidth: 600,
                        margin: '0 auto',
                        textAlign: 'center',
                        background: 'rgba(10,29,51,0.55)',
                        border: '1px solid var(--bp-line-strong)',
                        borderRadius: 14,
                        padding: '40px 24px',
                        color: 'var(--bp-ink)',
                    }}
                >
                    <div
                        style={{
                            fontFamily: 'var(--bb-display)',
                            fontSize: 22,
                            fontWeight: 600,
                            color: '#fff',
                            marginBottom: 8,
                        }}
                    >
                        Sign in to submit a blueprint
                    </div>
                    <p
                        style={{
                            fontSize: 14,
                            lineHeight: 1.6,
                            color: 'var(--bp-ink-soft)',
                            margin: '0 auto 24px',
                            maxWidth: 460,
                        }}
                    >
                        Your submission becomes a pull request on the BentoBoxWorld weblink
                        repo for a maintainer to review. By submitting you agree to our{' '}
                        <a
                            href="/terms"
                            style={{
                                color: 'var(--bp-accent)',
                                textDecoration: 'underline',
                            }}
                        >
                            Terms
                        </a>{' '}
                        and{' '}
                        <a
                            href="/privacy"
                            style={{
                                color: 'var(--bp-accent)',
                                textDecoration: 'underline',
                            }}
                        >
                            Privacy Policy
                        </a>
                        .
                    </p>
                    <a
                        href="/api/auth/discord/login"
                        className="bb-btn bb-btn-discord"
                        style={{ padding: '12px 20px', fontSize: 14 }}
                    >
                        <FontAwesomeIcon icon={faDiscord} />
                        Login with Discord
                    </a>
                </div>
            </section>
        </>
    );
}

/* ── Hero ──────────────────────────────────────────────────────── */

function SubmitHero({
    step,
    hasFile,
    signedIn,
    user,
    onLogout,
}: {
    step: 1 | 2 | 3;
    hasFile: boolean;
    signedIn: boolean;
    user?: SessionUser;
    onLogout?: () => void;
}): JSX.Element {
    return (
        <section
            className="bp-paper with-grid"
            style={{ padding: '36px 28px 28px', position: 'relative' }}
        >
            <div
                style={{
                    maxWidth: 1180,
                    margin: '0 auto',
                    position: 'relative',
                    zIndex: 1,
                }}
            >
                {/* Breadcrumb */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontFamily: 'var(--bb-mono)',
                        fontSize: 11,
                        color: 'var(--bp-ink-soft)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.14em',
                        marginBottom: 16,
                    }}
                >
                    <a
                        href="/blueprints"
                        style={{ color: 'var(--bp-ink-soft)', textDecoration: 'none' }}
                    >
                        Blueprints
                    </a>
                    <span style={{ opacity: 0.5 }}>/</span>
                    <span style={{ color: 'var(--bp-ink)' }}>Submit</span>
                </div>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'space-between',
                        gap: 24,
                        flexWrap: 'wrap',
                    }}
                >
                    <div>
                        <div
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontFamily: 'var(--bb-mono)',
                                fontSize: 11,
                                color: 'var(--bp-accent)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.14em',
                                marginBottom: 10,
                            }}
                        >
                            <FontAwesomeIcon icon={faUpload} />
                            Sheet 02 · New entry
                        </div>
                        <h1
                            style={{
                                fontFamily: 'var(--bb-display)',
                                fontSize: 44,
                                fontWeight: 700,
                                color: '#fff',
                                margin: 0,
                                letterSpacing: '-0.02em',
                                lineHeight: 1.05,
                            }}
                        >
                            Submit a blueprint.
                        </h1>
                        <p
                            style={{
                                fontSize: 15,
                                color: 'var(--bp-ink)',
                                marginTop: 10,
                                maxWidth: 580,
                                opacity: 0.86,
                                lineHeight: 1.5,
                            }}
                        >
                            We parse the file, you fill in the metadata, and we open a pull
                            request against{' '}
                            <span
                                style={{
                                    fontFamily: 'var(--bb-mono)',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                BentoBoxWorld/weblink
                            </span>{' '}
                            for a maintainer to review.
                        </p>
                    </div>

                    {signedIn && user ? (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: '8px 12px',
                                borderRadius: 999,
                                background: 'rgba(10,29,51,0.6)',
                                border: '1px solid var(--bp-line-strong)',
                            }}
                        >
                            {user.avatarUrl ? (
                                <img
                                    src={user.avatarUrl}
                                    alt=""
                                    style={{ width: 28, height: 28, borderRadius: 6 }}
                                />
                            ) : (
                                <div
                                    style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 6,
                                        background: '#e8b34a',
                                        display: 'grid',
                                        placeItems: 'center',
                                        fontFamily: 'var(--bb-mono)',
                                        fontSize: 11,
                                        color: '#3a2410',
                                        fontWeight: 700,
                                    }}
                                >
                                    {(user.username || '?').slice(0, 1).toUpperCase()}
                                </div>
                            )}
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    lineHeight: 1.1,
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: 13,
                                        color: '#fff',
                                        fontFamily: 'var(--bb-mono)',
                                    }}
                                >
                                    {user.globalName || user.username}
                                </span>
                                <span
                                    style={{
                                        fontSize: 10,
                                        color: 'var(--bp-ink-soft)',
                                        fontFamily: 'var(--bb-mono)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.1em',
                                    }}
                                >
                                    via Discord
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={onLogout}
                                title="Sign out"
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--bp-ink-soft)',
                                    cursor: 'pointer',
                                    padding: 4,
                                    display: 'grid',
                                    placeItems: 'center',
                                }}
                            >
                                <FontAwesomeIcon icon={faSignOutAlt} />
                            </button>
                        </div>
                    ) : null}
                </div>

                {/* Stepper */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0,
                        marginTop: 28,
                        paddingTop: 20,
                        borderTop: '1px solid var(--bp-line)',
                    }}
                >
                    {[
                        { n: '01', label: 'Upload file', done: hasFile, active: step === 1 },
                        {
                            n: '02',
                            label: 'Add metadata',
                            done: step === 3,
                            active: step === 2,
                        },
                        {
                            n: '03',
                            label: 'Review & PR',
                            done: false,
                            active: step === 3,
                        },
                    ].map((s, i, arr) => (
                        <React.Fragment key={s.n}>
                            <div
                                style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                            >
                                <span
                                    style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: '50%',
                                        background: s.done ? 'var(--bp-accent)' : 'transparent',
                                        border: `1px solid ${
                                            s.done
                                                ? 'var(--bp-accent)'
                                                : s.active
                                                ? 'var(--bp-accent)'
                                                : 'var(--bp-line-strong)'
                                        }`,
                                        color: s.done
                                            ? '#06121f'
                                            : s.active
                                            ? 'var(--bp-accent)'
                                            : 'var(--bp-ink-soft)',
                                        display: 'grid',
                                        placeItems: 'center',
                                        fontFamily: 'var(--bb-mono)',
                                        fontSize: 10,
                                        fontWeight: 700,
                                    }}
                                >
                                    {s.done ? (
                                        <FontAwesomeIcon
                                            icon={faCheck}
                                            style={{ fontSize: 9, color: '#06121f' }}
                                        />
                                    ) : (
                                        s.n
                                    )}
                                </span>
                                <span
                                    style={{
                                        fontSize: 12,
                                        fontFamily: 'var(--bb-mono)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.12em',
                                        color: s.active
                                            ? '#fff'
                                            : s.done
                                            ? 'var(--bp-ink)'
                                            : 'var(--bp-ink-soft)',
                                        fontWeight: s.active ? 600 : 500,
                                    }}
                                >
                                    {s.label}
                                </span>
                            </div>
                            {i < arr.length - 1 && (
                                <span
                                    style={{
                                        flex: 1,
                                        height: 1,
                                        background: 'var(--bp-line-strong)',
                                        margin: '0 14px',
                                    }}
                                />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ── Main form ─────────────────────────────────────────────────── */

function SubmitForm({
    user,
    catalog,
    onLogout,
}: {
    user: SessionUser;
    catalog: BlueprintCatalog | null;
    onLogout: () => void;
}): JSX.Element {
    const [dropped, setDropped] = useState<DroppedFile | null>(null);
    const [dropError, setDropError] = useState<string | null>(null);

    const [gameMode, setGameMode] = useState('');
    const [name, setName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [license, setLicense] = useState('EPL-2.0');
    const [author, setAuthor] = useState('');
    const [accepted, setAccepted] = useState(false);
    const [busy, setBusy] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<SubmitError | null>(null);

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

    const tagColors = useMemo(() => {
        const out: Record<string, string> = {};
        for (const [t, def] of Object.entries(catalog?.tags || {})) out[t] = def.color;
        return out;
    }, [catalog]);

    /* Default the credit-as field to the signed-in user the first time we render. */
    useEffect(() => {
        if (!author) setAuthor(user.globalName || user.username || '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function acceptFile(file: File) {
        setDropError(null);
        if (!file.name.toLowerCase().endsWith('.blueprint')) {
            setDropError(`File must end in .blueprint (got "${file.name}").`);
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            setDropError(
                `File is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is ${
                    MAX_FILE_SIZE / 1024 / 1024
                } MB.`,
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
            setDropError(
                "That doesn't look like a blueprint (missing xSize/ySize/zSize or blocks).",
            );
            return;
        }
        const slug = deriveSlug(file.name);
        setDropped({ file, json, derivedSlug: slug });
        setName((cur) => cur || slug);
        setDisplayName((cur) => cur || json.displayName || json.name || slug);
        if (Array.isArray(json.description) && json.description.length) {
            setDescription((cur) => cur || (json.description as string[]).join('\n'));
        }
    }

    /* Pick up file handed off from Blueprints page (in-memory or sessionStorage). */
    useEffect(() => {
        const incoming = takePendingBlueprint();
        if (incoming) {
            void acceptFile(incoming);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function clearFile() {
        setDropped(null);
        setDropError(null);
        /* Reset only the file-derived fields so the next drop's
         * `cur || …` prefill in acceptFile() actually takes effect.
         * User-entered fields (gameMode, tags, license, credit-as,
         * terms checkbox) are preserved. */
        setName('');
        setDisplayName('');
        setDescription('');
    }

    async function handleLogout() {
        try {
            await PostLogout(user.csrfToken);
        } finally {
            onLogout();
        }
    }

    const slugValid = NAME_REGEX.test(name);
    const slugInvalid = name.length > 0 && !slugValid;
    const descriptionLines = description.split('\n').length;
    const descriptionOverflow = descriptionLines > MAX_DESCRIPTION_LINES;

    const checklist = [
        { ok: !!dropped, label: 'Blueprint file uploaded' },
        { ok: slugValid, label: 'Slug is valid (a–z, 0–9, dot, dash, underscore)' },
        { ok: displayName.trim().length >= 2, label: 'Display name set' },
        { ok: !!gameMode, label: 'Game mode selected' },
        {
            ok: description.trim().length > 0 && !descriptionOverflow,
            label: `Description (≤ ${MAX_DESCRIPTION_LINES} lines)`,
        },
        { ok: tags.length >= 1, label: 'At least one tag' },
        { ok: accepted, label: 'Terms & Privacy accepted' },
    ];
    const checklistDone = checklist.filter((c) => c.ok).length;
    const canSubmit =
        !busy &&
        !!dropped &&
        slugValid &&
        displayName.trim().length >= 2 &&
        !!gameMode &&
        description.trim().length > 0 &&
        !descriptionOverflow &&
        tags.length >= 1 &&
        accepted;

    async function submit() {
        if (!dropped || !canSubmit) return;
        setBusy(true);
        setError(null);
        setSuccess(null);
        try {
            const result = await PostSubmitBlueprint(
                user.csrfToken,
                {
                    gameMode,
                    name,
                    displayName,
                    description,
                    tags: tags.join(','),
                },
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

    if (success) {
        return (
            <SuccessState
                prUrl={success}
                onAnother={() => {
                    setSuccess(null);
                    setError(null);
                    setDropped(null);
                    setName('');
                    setDisplayName('');
                    setDescription('');
                    setTags([]);
                    setAccepted(false);
                }}
            />
        );
    }

    const summary: ParsedSummary | null = useMemo(
        () => (dropped ? summarizeBlueprint(dropped.json) : null),
        [dropped],
    );

    /* Real voxels for the live card preview. Computed once per file
     * so re-renders from typing don't re-walk the parsed JSON. */
    const voxels: RealVoxel[] = useMemo(
        () => (dropped ? deriveVoxels(dropped.json.blocks) : []),
        [dropped],
    );

    const gameModeLower = gameMode ? gameMode.toLowerCase() : 'gamemode';
    const slugForPath = name || 'slug';

    return (
        <>
            <SubmitHero
                step={2}
                hasFile={!!dropped}
                signedIn
                user={user}
                onLogout={handleLogout}
            />

            <section
                style={{
                    padding: '36px 28px 0',
                    minHeight: 800,
                }}
            >
                <div
                    className="bb-grid-2"
                    style={{
                        maxWidth: 1180,
                        margin: '0 auto',
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) 380px',
                        gap: 40,
                        alignItems: 'start',
                    }}
                >
                    {/* LEFT — form */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 24,
                            minWidth: 0,
                        }}
                    >
                        {/* File area */}
                        <div>
                            <FieldLabel>File</FieldLabel>
                            {dropped && summary ? (
                                <FileReceipt
                                    file={dropped.file}
                                    summary={summary}
                                    derivedSlug={dropped.derivedSlug}
                                    onReplace={clearFile}
                                />
                            ) : (
                                <EmptyDrop onAccept={(f) => void acceptFile(f)} />
                            )}
                            {dropError && (
                                <div
                                    style={{
                                        marginTop: 10,
                                        padding: '10px 14px',
                                        borderRadius: 8,
                                        background: 'rgba(207,27,33,0.10)',
                                        border: '1px solid rgba(207,27,33,0.35)',
                                        color: '#ffb4b4',
                                        fontSize: 13,
                                    }}
                                >
                                    {dropError}
                                </div>
                            )}
                        </div>

                        {/* Metadata card */}
                        <div
                            style={{
                                background: 'rgba(10,29,51,0.45)',
                                border: '1px solid var(--bp-line)',
                                borderRadius: 14,
                                padding: 24,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 22,
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    fontSize: 11,
                                    fontFamily: 'var(--bb-mono)',
                                    color: 'var(--bp-ink-soft)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.12em',
                                    fontWeight: 600,
                                }}
                            >
                                <span
                                    style={{
                                        width: 22,
                                        height: 1,
                                        background: 'var(--bp-line-strong)',
                                    }}
                                />
                                Metadata
                            </div>

                            {/* Game mode */}
                            <div>
                                <FieldLabel
                                    required
                                    hint="which BentoBox game mode is this for?"
                                >
                                    Game mode
                                </FieldLabel>
                                <GameModePicker
                                    value={gameMode}
                                    onChange={setGameMode}
                                    options={gameModeOptions}
                                    catalog={catalog}
                                />
                            </div>

                            {/* Slug + display name */}
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: 16,
                                }}
                            >
                                <div>
                                    <FieldLabel required hint="filename slug">
                                        Name
                                    </FieldLabel>
                                    <input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        spellCheck={false}
                                        style={bpMonoInputStyle({ invalid: slugInvalid })}
                                    />
                                    <HelpText tone={slugInvalid ? 'error' : 'soft'}>
                                        {slugInvalid
                                            ? 'Use only A–Z, a–z, 0–9, dots, dashes, underscores. 1–64 chars.'
                                            : 'Becomes the filename in the catalog.'}
                                    </HelpText>
                                </div>
                                <div>
                                    <FieldLabel required hint="shown on the card">
                                        Display name
                                    </FieldLabel>
                                    <input
                                        value={displayName}
                                        onChange={(e) =>
                                            setDisplayName(e.target.value.slice(0, 60))
                                        }
                                        style={bpInputStyle()}
                                    />
                                    <HelpText>Title-case is fine. Up to 60 characters.</HelpText>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <FieldLabel hint="what is this island? what's the gimmick?">
                                    Description
                                </FieldLabel>
                                <DescriptionField
                                    value={description}
                                    onChange={setDescription}
                                />
                            </div>

                            {/* Tags */}
                            <div>
                                <FieldLabel hint={`up to ${MAX_TAGS}, lowercase`}>
                                    Tags
                                </FieldLabel>
                                <TagsField
                                    tags={tags}
                                    onChange={setTags}
                                    tagColors={tagColors}
                                />
                            </div>

                            {/* License + author */}
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: 16,
                                }}
                            >
                                <div>
                                    <FieldLabel required>License</FieldLabel>
                                    <select
                                        value={license}
                                        onChange={(e) => setLicense(e.target.value)}
                                        style={bpSelectStyle()}
                                    >
                                        <option>EPL-2.0</option>
                                        <option>MIT</option>
                                        <option>CC0-1.0</option>
                                        <option>CC-BY-4.0</option>
                                        <option>CC-BY-SA-4.0</option>
                                    </select>
                                    <HelpText>
                                        Match the BentoBox repo default unless you have a
                                        reason.
                                    </HelpText>
                                </div>
                                <div>
                                    <FieldLabel hint="appears on the card byline">
                                        Credit as
                                    </FieldLabel>
                                    <input
                                        value={author}
                                        onChange={(e) => setAuthor(e.target.value)}
                                        style={bpMonoInputStyle()}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Terms */}
                        <label
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 10,
                                padding: '14px 16px',
                                borderRadius: 12,
                                background: 'rgba(10,29,51,0.45)',
                                border: '1px solid var(--bp-line)',
                                cursor: 'pointer',
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={accepted}
                                onChange={(e) => setAccepted(e.target.checked)}
                                style={{
                                    marginTop: 3,
                                    width: 16,
                                    height: 16,
                                    accentColor: 'var(--bp-accent)',
                                    flex: '0 0 auto',
                                }}
                            />
                            <span
                                style={{
                                    fontSize: 13,
                                    color: 'var(--bp-ink)',
                                    lineHeight: 1.5,
                                }}
                            >
                                I have the right to share this blueprint, and I accept the{' '}
                                <a
                                    href="/terms"
                                    style={{ color: 'var(--bp-accent)' }}
                                >
                                    Terms
                                </a>{' '}
                                and{' '}
                                <a
                                    href="/privacy"
                                    style={{ color: 'var(--bp-accent)' }}
                                >
                                    Privacy Policy
                                </a>
                                . By submitting, I agree to license my contribution under{' '}
                                <span style={{ fontFamily: 'var(--bb-mono)' }}>{license}</span>.
                            </span>
                        </label>

                        {error && (
                            <div
                                style={{
                                    padding: '12px 14px',
                                    borderRadius: 12,
                                    background: 'rgba(207,27,33,0.10)',
                                    border: '1px solid rgba(207,27,33,0.35)',
                                    color: '#ffb4b4',
                                    fontSize: 13,
                                    lineHeight: 1.5,
                                }}
                            >
                                <strong style={{ color: '#fff' }}>
                                    Submit failed{error.error ? ` · ${error.error}` : ''}
                                </strong>
                                <div style={{ marginTop: 4 }}>
                                    {error.reason || 'Try again in a moment.'}
                                </div>
                            </div>
                        )}

                        {/* Spacer so the sticky bar doesn't overlap content */}
                        <div style={{ height: 24 }} />
                    </div>

                    {/* RIGHT — preview rail */}
                    <aside
                        style={{
                            position: 'sticky',
                            top: 88,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 11,
                                fontFamily: 'var(--bb-mono)',
                                color: 'var(--bp-ink-soft)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.12em',
                                fontWeight: 600,
                            }}
                        >
                            Card preview
                        </div>
                        <PreviewBlueprintCard
                            displayName={displayName}
                            gameMode={gameMode}
                            author={author}
                            description={description}
                            tags={tags}
                            license={license}
                            file={dropped?.file}
                            summary={summary}
                            voxels={voxels}
                            tagColors={tagColors}
                        />
                        <Checklist done={checklistDone} items={checklist} />
                        <div
                            style={{
                                borderRadius: 12,
                                padding: 14,
                                background: 'rgba(127,179,204,0.06)',
                                border: '1px dashed var(--bp-line-strong)',
                                fontSize: 12,
                                color: 'var(--bp-ink-soft)',
                                lineHeight: 1.55,
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    color: 'var(--bp-ink)',
                                    fontFamily: 'var(--bb-mono)',
                                    fontSize: 11,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    marginBottom: 4,
                                }}
                            >
                                <FontAwesomeIcon icon={faGithub} /> What happens next
                            </div>
                            We commit your file + metadata to a new branch and open a PR.
                            A maintainer reviews within 1–3 days; you&rsquo;ll get a Discord
                            ping when it&rsquo;s merged.
                        </div>
                    </aside>
                </div>
            </section>

            {/* Sticky action bar */}
            <div
                style={{
                    position: 'sticky',
                    bottom: 0,
                    zIndex: 5,
                    background: 'rgba(10, 21, 38, 0.92)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    borderTop: '1px solid var(--bp-line-strong)',
                    padding: '16px 28px',
                    marginTop: 24,
                }}
            >
                <div
                    style={{
                        maxWidth: 1180,
                        margin: '0 auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        flexWrap: 'wrap',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            minWidth: 0,
                        }}
                    >
                        <span
                            style={{
                                fontSize: 13,
                                color: 'var(--bp-ink)',
                                fontFamily: 'var(--bb-mono)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            {slugForPath}.blueprint
                        </span>
                        <span
                            style={{
                                fontSize: 11,
                                color: 'var(--bp-ink-soft)',
                                fontFamily: 'var(--bb-mono)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            will land at{' '}
                            <span style={{ color: 'var(--bp-ink)' }}>
                                weblink/blueprints/{gameModeLower}/{slugForPath}.blueprint
                            </span>
                        </span>
                    </div>
                    <div style={{ flex: 1 }} />
                    <button
                        type="button"
                        onClick={submit}
                        disabled={!canSubmit}
                        className="bb-btn"
                        style={{
                            background: canSubmit
                                ? 'var(--bp-accent)'
                                : 'rgba(127,179,204,0.18)',
                            color: canSubmit ? '#06121f' : 'var(--bp-ink-soft)',
                            cursor: canSubmit ? 'pointer' : 'not-allowed',
                            padding: '12px 20px',
                            fontSize: 14,
                        }}
                    >
                        <FontAwesomeIcon icon={faGithub} />
                        {busy ? 'Submitting…' : 'Open pull request'}
                        {!busy && <FontAwesomeIcon icon={faArrowRight} />}
                    </button>
                </div>
            </div>
        </>
    );
}

/* ── Field primitives ──────────────────────────────────────────── */

function FieldLabel({
    children,
    hint,
    required,
}: {
    children: React.ReactNode;
    hint?: string;
    required?: boolean;
}): JSX.Element {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                marginBottom: 6,
                flexWrap: 'wrap',
            }}
        >
            <label
                style={{
                    fontSize: 11,
                    fontFamily: 'var(--bb-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: 'var(--bp-ink-soft)',
                    fontWeight: 600,
                }}
            >
                {children}
                {required && (
                    <span style={{ color: 'var(--bp-accent)', marginLeft: 4 }}>*</span>
                )}
            </label>
            {hint && (
                <span
                    style={{
                        fontSize: 11,
                        color: 'var(--bp-ink-soft)',
                        opacity: 0.7,
                    }}
                >
                    {hint}
                </span>
            )}
        </div>
    );
}

function bpInputStyle({ invalid }: { invalid?: boolean } = {}): React.CSSProperties {
    return {
        width: '100%',
        padding: '11px 13px',
        background: 'rgba(10, 29, 51, 0.55)',
        border: `1px solid ${invalid ? 'var(--bb-rose)' : 'var(--bp-line-strong)'}`,
        borderRadius: 10,
        color: 'var(--bp-ink)',
        fontFamily: 'var(--bb-sans)',
        fontSize: 14,
        outline: 'none',
        transition: 'border-color 120ms ease, background 120ms ease',
    };
}
function bpMonoInputStyle(o?: { invalid?: boolean }): React.CSSProperties {
    return { ...bpInputStyle(o), fontFamily: 'var(--bb-mono)', fontSize: 13 };
}
function bpSelectStyle(): React.CSSProperties {
    return {
        ...bpInputStyle(),
        appearance: 'none',
        WebkitAppearance: 'none',
        cursor: 'pointer',
        backgroundImage:
            'linear-gradient(45deg, transparent 50%, var(--bp-ink-soft) 50%), linear-gradient(135deg, var(--bp-ink-soft) 50%, transparent 50%)',
        backgroundPosition: 'calc(100% - 18px) 18px, calc(100% - 13px) 18px',
        backgroundSize: '5px 5px, 5px 5px',
        backgroundRepeat: 'no-repeat',
        paddingRight: 32,
    };
}

function HelpText({
    children,
    tone = 'soft',
}: {
    children: React.ReactNode;
    tone?: 'soft' | 'error';
}): JSX.Element {
    const color = tone === 'error' ? 'var(--bb-rose)' : 'var(--bp-ink-soft)';
    return (
        <div style={{ fontSize: 12, color, marginTop: 6, lineHeight: 1.45 }}>
            {children}
        </div>
    );
}

/* ── File receipt ──────────────────────────────────────────────── */

function FileReceipt({
    file,
    summary,
    derivedSlug,
    onReplace,
}: {
    file: File;
    summary: ParsedSummary;
    derivedSlug: string;
    onReplace: () => void;
}): JSX.Element {
    return (
        <div
            style={{
                position: 'relative',
                borderRadius: 14,
                background:
                    'radial-gradient(600px 200px at 0% 0%, rgba(127,179,204,0.10), transparent 60%), rgba(10, 29, 51, 0.65)',
                border: '1px solid var(--bp-line-strong)',
                overflow: 'hidden',
            }}
        >
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    backgroundImage:
                        'linear-gradient(var(--bp-line) 1px, transparent 1px), linear-gradient(90deg, var(--bp-line) 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                    WebkitMaskImage:
                        'linear-gradient(180deg, rgba(0,0,0,0.5), rgba(0,0,0,0.05))',
                    maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.5), rgba(0,0,0,0.05))',
                }}
            />
            <div
                style={{
                    position: 'relative',
                    padding: '18px 20px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 16,
                    flexWrap: 'wrap',
                }}
            >
                <div
                    aria-hidden
                    style={{
                        flex: '0 0 auto',
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: 'var(--bp-accent)',
                        color: '#06121f',
                        display: 'grid',
                        placeItems: 'center',
                        boxShadow: '0 0 0 4px rgba(127,179,204,0.18)',
                    }}
                >
                    <FontAwesomeIcon icon={faCheck} style={{ fontSize: 16 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 10,
                            flexWrap: 'wrap',
                        }}
                    >
                        <span
                            style={{
                                fontFamily: 'var(--bb-mono)',
                                fontSize: 15,
                                color: '#fff',
                                fontWeight: 600,
                                letterSpacing: '-0.005em',
                                wordBreak: 'break-all',
                            }}
                        >
                            {file.name}
                        </span>
                        <span className="bp-chip">{humanSize(file.size)}</span>
                        <span className="bp-chip">
                            {summary.dim.x}×{summary.dim.y}×{summary.dim.z}
                        </span>
                    </div>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                            gap: 0,
                            marginTop: 12,
                            border: '1px solid var(--bp-line)',
                            borderRadius: 8,
                            background: 'rgba(10,29,51,0.4)',
                        }}
                    >
                        <SpecCell label="Blocks" value={summary.blocks.toLocaleString()} />
                        <SpecCell label="Entities" value={summary.entities.toString()} />
                        <SpecCell label="Biome" value={summary.biome} mono />
                        <SpecCell
                            label="Sinking"
                            value={summary.sinking ? 'yes' : 'no'}
                            accent={summary.sinking}
                            last
                        />
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            gap: 16,
                            marginTop: 12,
                            fontSize: 12,
                            color: 'var(--bp-ink-soft)',
                            fontFamily: 'var(--bb-mono)',
                            flexWrap: 'wrap',
                        }}
                    >
                        <span>
                            slug from filename:{' '}
                            <span style={{ color: 'var(--bp-ink)' }}>{derivedSlug}</span>
                        </span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onReplace}
                    style={{
                        flex: '0 0 auto',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: 'transparent',
                        border: '1px solid var(--bp-line-strong)',
                        color: 'var(--bp-ink)',
                        fontSize: 12,
                        fontFamily: 'var(--bb-sans)',
                        cursor: 'pointer',
                    }}
                >
                    <FontAwesomeIcon icon={faUpload} style={{ fontSize: 11 }} /> Replace
                </button>
            </div>
        </div>
    );
}

function SpecCell({
    label,
    value,
    mono,
    accent,
    last,
}: {
    label: string;
    value: string;
    mono?: boolean;
    accent?: boolean;
    last?: boolean;
}): JSX.Element {
    return (
        <div
            style={{
                padding: '10px 12px',
                borderRight: last ? 'none' : '1px solid var(--bp-line)',
            }}
        >
            <div
                style={{
                    fontSize: 9,
                    color: 'var(--bp-ink-soft)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    marginBottom: 2,
                }}
            >
                {label}
            </div>
            <div
                style={{
                    fontSize: 13,
                    color: accent ? 'var(--bp-accent)' : '#fff',
                    fontFamily: mono ? 'var(--bb-mono)' : 'var(--bb-sans)',
                    fontWeight: 600,
                }}
            >
                {value}
            </div>
        </div>
    );
}

/* ── Empty drop ────────────────────────────────────────────────── */

function EmptyDrop({ onAccept }: { onAccept: (f: File) => void }): JSX.Element {
    const [drag, setDrag] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    inputRef.current?.click();
                }
            }}
            onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const file = e.dataTransfer.files?.[0];
                if (file) onAccept(file);
            }}
            style={{
                cursor: 'pointer',
                position: 'relative',
                borderRadius: 14,
                background: drag ? 'rgba(127,179,204,0.10)' : 'rgba(10, 29, 51, 0.55)',
                border: `1.5px dashed ${drag ? 'var(--bp-accent)' : 'var(--bp-line-strong)'}`,
                padding: '32px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                transition: 'background 120ms, border-color 120ms',
                flexWrap: 'wrap',
            }}
        >
            <input
                ref={inputRef}
                type="file"
                accept=".blueprint"
                style={{ display: 'none' }}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onAccept(file);
                    e.target.value = '';
                }}
            />
            <div
                aria-hidden
                style={{
                    flex: '0 0 auto',
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    background: 'rgba(127,179,204,0.10)',
                    border: '1px solid var(--bp-line-strong)',
                    display: 'grid',
                    placeItems: 'center',
                }}
            >
                <FontAwesomeIcon
                    icon={faUpload}
                    style={{ color: 'var(--bp-ink)', fontSize: 22 }}
                />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        fontFamily: 'var(--bb-display)',
                        fontSize: 18,
                        color: '#fff',
                        fontWeight: 600,
                    }}
                >
                    Drop a{' '}
                    <code style={{ fontFamily: 'var(--bb-mono)', fontSize: 15 }}>
                        .blueprint
                    </code>{' '}
                    file here
                </div>
                <div
                    style={{
                        fontSize: 13,
                        color: 'var(--bp-ink-soft)',
                        marginTop: 4,
                    }}
                >
                    We&rsquo;ll read its dimensions, block counts, and biomes so you don&rsquo;t
                    have to retype them. Max 5 MB.
                </div>
            </div>
            <span
                className="bb-btn"
                style={{
                    background: 'var(--bp-ink)',
                    color: 'var(--bp-paper)',
                    padding: '10px 16px',
                    fontSize: 13,
                    pointerEvents: 'none',
                }}
            >
                Choose file
            </span>
        </div>
    );
}

/* ── Game mode picker ──────────────────────────────────────────── */

function GameModePicker({
    value,
    onChange,
    options,
    catalog,
}: {
    value: string;
    onChange: (v: string) => void;
    options: string[];
    catalog: BlueprintCatalog | null;
}): JSX.Element {
    const list = options.length ? options : Object.keys(GM_SWATCH);
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 8,
            }}
        >
            {list.map((gm) => {
                const active = value === gm;
                const swatch = swatchForGameMode(gm, catalog);
                const label = catalog?.gameModes?.[gm]?.displayName || gm;
                return (
                    <button
                        key={gm}
                        type="button"
                        onClick={() => onChange(gm)}
                        style={{
                            textAlign: 'left',
                            padding: '10px 12px',
                            borderRadius: 10,
                            background: active
                                ? 'rgba(127,179,204,0.14)'
                                : 'rgba(10,29,51,0.5)',
                            border: `1px solid ${
                                active ? 'var(--bp-accent)' : 'var(--bp-line)'
                            }`,
                            color: 'var(--bp-ink)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            transition: 'border-color 120ms, background 120ms',
                        }}
                    >
                        <span
                            aria-hidden
                            style={{
                                width: 10,
                                height: 10,
                                borderRadius: 2,
                                background: swatch,
                                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)',
                                flexShrink: 0,
                            }}
                        />
                        <span
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                minWidth: 0,
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 13,
                                    color: '#fff',
                                    fontWeight: 600,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {label}
                            </span>
                            <span
                                style={{
                                    fontSize: 10,
                                    color: 'var(--bp-ink-soft)',
                                    fontFamily: 'var(--bb-mono)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                }}
                            >
                                {gm.toLowerCase()}
                            </span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

/* ── Description with line counter ─────────────────────────────── */

function DescriptionField({
    value,
    onChange,
}: {
    value: string;
    onChange: (v: string) => void;
}): JSX.Element {
    const lines = value.split('\n').length;
    const overflow = lines > MAX_DESCRIPTION_LINES;
    const counterColor = overflow
        ? 'var(--bb-rose)'
        : lines >= MAX_DESCRIPTION_LINES - 1
        ? 'var(--bp-accent)'
        : 'var(--bp-ink-soft)';
    return (
        <div>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={5}
                placeholder={
                    'One sentence per line.\nKeep it short — 3-5 lines is the sweet spot.'
                }
                style={{
                    ...bpInputStyle({ invalid: overflow }),
                    resize: 'vertical',
                    minHeight: 110,
                    lineHeight: 1.55,
                }}
            />
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 6,
                }}
            >
                <span style={{ fontSize: 12, color: 'var(--bp-ink-soft)' }}>
                    Each line shows on its own row in the card preview.
                </span>
                <span
                    style={{
                        fontSize: 11,
                        fontFamily: 'var(--bb-mono)',
                        color: counterColor,
                    }}
                >
                    {lines}/{MAX_DESCRIPTION_LINES} lines
                </span>
            </div>
        </div>
    );
}

/* ── Tags field ────────────────────────────────────────────────── */

function TagsField({
    tags,
    onChange,
    tagColors,
}: {
    tags: string[];
    onChange: (t: string[]) => void;
    tagColors: Record<string, string>;
}): JSX.Element {
    const [draft, setDraft] = useState('');
    const inputRef = useRef<HTMLInputElement | null>(null);

    const add = (raw: string) => {
        const t = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (!t) return;
        if (tags.includes(t)) return;
        if (tags.length >= MAX_TAGS) return;
        onChange([...tags, t]);
        setDraft('');
    };

    const remove = (t: string) => onChange(tags.filter((x) => x !== t));

    return (
        <div>
            <div
                onClick={() => inputRef.current?.focus()}
                style={{
                    ...bpInputStyle(),
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    alignItems: 'center',
                    minHeight: 42,
                    padding: '7px 10px',
                    cursor: 'text',
                }}
            >
                {tags.map((t) => (
                    <span
                        key={t}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '3px 4px 3px 8px',
                            borderRadius: 4,
                            background: tagColors[t] || '#3a4a5a',
                            color: '#fff',
                            fontSize: 11,
                            fontFamily: 'var(--bb-mono)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                        }}
                    >
                        {t}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                remove(t);
                            }}
                            aria-label={`Remove ${t}`}
                            style={{
                                background: 'rgba(0,0,0,0.25)',
                                border: 'none',
                                color: '#fff',
                                width: 16,
                                height: 16,
                                borderRadius: 3,
                                cursor: 'pointer',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: 10,
                                lineHeight: 1,
                                padding: 0,
                            }}
                        >
                            <FontAwesomeIcon icon={faTimes} style={{ fontSize: 8 }} />
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            add(draft);
                        } else if (e.key === 'Backspace' && !draft && tags.length) {
                            remove(tags[tags.length - 1]);
                        }
                    }}
                    onBlur={() => draft && add(draft)}
                    placeholder={tags.length === 0 ? 'starter, overworld, tree…' : ''}
                    style={{
                        flex: 1,
                        minWidth: 120,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: 'var(--bp-ink)',
                        fontSize: 13,
                        fontFamily: 'var(--bb-sans)',
                        padding: '4px 2px',
                    }}
                />
            </div>
            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginTop: 8,
                    alignItems: 'center',
                }}
            >
                <span
                    style={{
                        fontSize: 11,
                        color: 'var(--bp-ink-soft)',
                        fontFamily: 'var(--bb-mono)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        marginRight: 4,
                    }}
                >
                    Suggested
                </span>
                {SUGGESTED_TAGS.filter((t) => !tags.includes(t))
                    .slice(0, 7)
                    .map((t) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => add(t)}
                            style={{
                                padding: '3px 9px',
                                borderRadius: 999,
                                background: 'rgba(10,29,51,0.5)',
                                border: '1px dashed var(--bp-line-strong)',
                                color: 'var(--bp-ink-soft)',
                                fontSize: 11,
                                fontFamily: 'var(--bb-mono)',
                                cursor: 'pointer',
                            }}
                        >
                            + {t}
                        </button>
                    ))}
            </div>
        </div>
    );
}

/* ── Live preview card (mirrors Blueprints gallery card) ───────── */

function PreviewBlueprintCard({
    displayName,
    gameMode,
    author,
    description,
    tags,
    license,
    file,
    summary,
    voxels,
    tagColors,
}: {
    displayName: string;
    gameMode: string;
    author: string;
    description: string;
    tags: string[];
    license: string;
    file?: File;
    summary: ParsedSummary | null;
    voxels: RealVoxel[];
    tagColors: Record<string, string>;
}): JSX.Element {
    const dim = summary?.dim || { x: 0, y: 0, z: 0 };
    const blocks = summary?.blocks ?? 0;
    const entities = summary?.entities ?? 0;
    const variant: Variant =
        summary && summary.dim.x ? variantFor(summary.dim) : 'island';
    const sizeBucket = blocks > 1500 ? 'Large' : blocks > 400 ? 'Medium' : 'Small';

    return (
        <div
            style={{
                position: 'relative',
                background: '#0c2038',
                border: '1px solid var(--bp-line-strong)',
                borderRadius: 14,
                overflow: 'hidden',
                boxShadow: '0 18px 40px -16px rgba(0,0,0,0.55)',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    zIndex: 3,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'rgba(127,179,204,0.18)',
                    border: '1px solid var(--bp-accent)',
                    color: 'var(--bp-accent)',
                    fontSize: 10,
                    fontFamily: 'var(--bb-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    fontWeight: 600,
                }}
            >
                <span
                    style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--bp-accent)',
                    }}
                />
                Live preview
            </div>

            <div
                style={{
                    position: 'relative',
                    height: 168,
                    background:
                        'radial-gradient(600px 200px at 30% 0%, rgba(127,179,204,0.10), transparent 60%), #0a1d33',
                }}
            >
                <div
                    aria-hidden
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage:
                            'linear-gradient(var(--bp-line) 1px, transparent 1px), linear-gradient(90deg, var(--bp-line) 1px, transparent 1px)',
                        backgroundSize: '24px 24px',
                        WebkitMaskImage:
                            'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.15))',
                        maskImage:
                            'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.15))',
                    }}
                />
                {summary && (
                    <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
                        <span className="bp-chip">
                            {sizeBucket} · {dim.x}×{dim.y}×{dim.z}
                        </span>
                    </div>
                )}
                {summary?.sinking && (
                    <div style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 2 }}>
                        <span className="bp-chip" style={{ color: '#a8d6ee' }}>
                            Sinking
                        </span>
                    </div>
                )}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'grid',
                        placeItems: 'center',
                        zIndex: 1,
                    }}
                >
                    {voxels.length > 0 ? (
                        <BlueprintVoxels
                            voxels={voxels}
                            width={260}
                            height={150}
                        />
                    ) : summary ? (
                        <VoxelStack
                            topBlocks={summary.topBlocks}
                            variant={variant}
                            width={260}
                            height={150}
                        />
                    ) : (
                        <div
                            style={{
                                fontFamily: 'var(--bb-mono)',
                                fontSize: 11,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                color: 'var(--bp-ink-soft)',
                                padding: '10px 14px',
                                border: '1px dashed var(--bp-line-strong)',
                                borderRadius: 6,
                                background: 'rgba(10, 29, 51, 0.6)',
                            }}
                        >
                            Drop a file
                        </div>
                    )}
                </div>
            </div>

            <div style={{ padding: 16, color: 'var(--bp-ink)' }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: 8,
                    }}
                >
                    <div
                        style={{
                            fontFamily: 'var(--bb-display)',
                            fontSize: 18,
                            fontWeight: 600,
                            letterSpacing: '-0.01em',
                            color: '#fff',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            minWidth: 0,
                        }}
                    >
                        {displayName || (
                            <span
                                style={{
                                    color: 'var(--bp-ink-soft)',
                                    fontStyle: 'italic',
                                }}
                            >
                                Display name…
                            </span>
                        )}
                    </div>
                </div>
                <div
                    style={{
                        fontSize: 12,
                        color: 'var(--bp-ink-soft)',
                        marginTop: 2,
                        fontFamily: 'var(--bb-mono)',
                    }}
                >
                    {gameMode || 'select a game mode'} · {author || 'tastybento'}
                </div>

                <div
                    style={{
                        marginTop: 10,
                        fontSize: 13,
                        lineHeight: 1.5,
                        opacity: 0.92,
                        minHeight: 60,
                    }}
                >
                    {description ? (
                        description
                            .split('\n')
                            .slice(0, 4)
                            .map((l, i) => (
                                <div key={i} style={{ marginBottom: 2 }}>
                                    {l || <span style={{ opacity: 0.4 }}>·</span>}
                                </div>
                            ))
                    ) : (
                        <span
                            style={{
                                color: 'var(--bp-ink-soft)',
                                fontStyle: 'italic',
                            }}
                        >
                            Description appears here…
                        </span>
                    )}
                </div>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 8,
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: '1px solid var(--bp-line)',
                    }}
                >
                    <PreviewStat label="Blocks" value={blocks.toLocaleString()} />
                    <PreviewStat label="Entities" value={entities.toString()} />
                    <PreviewStat
                        label="File"
                        value={file ? humanSize(file.size) : '—'}
                    />
                </div>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 14,
                        gap: 8,
                    }}
                >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {tags.length === 0 ? (
                            <span
                                style={{
                                    fontSize: 11,
                                    color: 'var(--bp-ink-soft)',
                                    fontFamily: 'var(--bb-mono)',
                                    fontStyle: 'italic',
                                }}
                            >
                                tags…
                            </span>
                        ) : (
                            tags.map((t) => (
                                <span
                                    key={t}
                                    style={{
                                        fontSize: 10,
                                        fontFamily: 'var(--bb-mono)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.06em',
                                        padding: '2px 6px',
                                        borderRadius: 3,
                                        background: tagColors[t] || '#3a4a5a',
                                        color: '#fff',
                                    }}
                                >
                                    {t}
                                </span>
                            ))
                        )}
                    </div>
                    <span
                        style={{
                            fontSize: 10,
                            color: 'var(--bp-ink-soft)',
                            fontFamily: 'var(--bb-mono)',
                        }}
                    >
                        {license}
                    </span>
                </div>
            </div>
        </div>
    );
}

function PreviewStat({
    label,
    value,
}: {
    label: string;
    value: string;
}): JSX.Element {
    return (
        <div>
            <div
                style={{
                    fontSize: 10,
                    color: 'var(--bp-ink-soft)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                }}
            >
                {label}
            </div>
            <div
                style={{
                    fontFamily: 'var(--bb-mono)',
                    fontSize: 13,
                    color: '#fff',
                }}
            >
                {value}
            </div>
        </div>
    );
}

/* ── Checklist ─────────────────────────────────────────────────── */

function Checklist({
    done,
    items,
}: {
    done: number;
    items: { ok: boolean; label: string }[];
}): JSX.Element {
    const total = items.length;
    return (
        <div
            style={{
                borderRadius: 12,
                background: 'rgba(10,29,51,0.55)',
                border: '1px solid var(--bp-line-strong)',
                padding: 16,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                }}
            >
                <span
                    style={{
                        fontSize: 11,
                        fontFamily: 'var(--bb-mono)',
                        color: 'var(--bp-ink-soft)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.12em',
                        fontWeight: 600,
                    }}
                >
                    Before submitting
                </span>
                <span
                    style={{
                        fontSize: 11,
                        fontFamily: 'var(--bb-mono)',
                        color: done === total ? 'var(--bp-accent)' : 'var(--bp-ink-soft)',
                    }}
                >
                    {done}/{total}
                </span>
            </div>
            <ul
                style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                }}
            >
                {items.map((it, i) => (
                    <li
                        key={i}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 13,
                            color: it.ok ? 'var(--bp-ink)' : 'var(--bp-ink-soft)',
                        }}
                    >
                        <span
                            aria-hidden
                            style={{
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                background: it.ok ? 'var(--bp-accent)' : 'transparent',
                                border: `1px solid ${
                                    it.ok ? 'var(--bp-accent)' : 'var(--bp-line-strong)'
                                }`,
                                display: 'grid',
                                placeItems: 'center',
                                flex: '0 0 auto',
                            }}
                        >
                            {it.ok && (
                                <FontAwesomeIcon
                                    icon={faCheck}
                                    style={{ fontSize: 8, color: '#06121f' }}
                                />
                            )}
                        </span>
                        <span>{it.label}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/* ── Success state ─────────────────────────────────────────────── */

function SuccessState({
    prUrl,
    onAnother,
}: {
    prUrl: string;
    onAnother: () => void;
}): JSX.Element {
    return (
        <>
            <SubmitHero step={3} hasFile signedIn={false} />
            <section style={{ padding: '24px 28px 80px' }}>
                <div
                    style={{
                        maxWidth: 600,
                        margin: '0 auto',
                        textAlign: 'center',
                        background: 'rgba(10,29,51,0.55)',
                        border: '1px solid var(--bp-line-strong)',
                        borderRadius: 14,
                        padding: '40px 24px',
                        color: 'var(--bp-ink)',
                    }}
                >
                    <div
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: 14,
                            background: 'var(--bp-accent)',
                            color: '#06121f',
                            display: 'grid',
                            placeItems: 'center',
                            margin: '0 auto 14px',
                        }}
                    >
                        <FontAwesomeIcon icon={faCheck} style={{ fontSize: 22 }} />
                    </div>
                    <div
                        style={{
                            fontFamily: 'var(--bb-display)',
                            fontSize: 24,
                            fontWeight: 700,
                            color: '#fff',
                            marginBottom: 6,
                            letterSpacing: '-0.01em',
                        }}
                    >
                        Pull request opened
                    </div>
                    <p
                        style={{
                            fontSize: 14,
                            lineHeight: 1.6,
                            color: 'var(--bp-ink-soft)',
                            margin: '0 auto 20px',
                            maxWidth: 460,
                        }}
                    >
                        A maintainer will review and merge it. You&rsquo;ll get a Discord
                        ping when it&rsquo;s in.
                    </p>
                    <a
                        href={prUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="bb-btn"
                        style={{
                            background: 'var(--bp-accent)',
                            color: '#06121f',
                            padding: '10px 18px',
                            fontSize: 13,
                            marginRight: 8,
                        }}
                    >
                        <FontAwesomeIcon icon={faGithub} />
                        View pull request
                        <FontAwesomeIcon icon={faExternalLinkAlt} />
                    </a>
                    <button
                        type="button"
                        onClick={onAnother}
                        className="bb-btn bb-btn-ghost"
                        style={{
                            borderColor: 'var(--bp-line-strong)',
                            color: 'var(--bp-ink)',
                            padding: '10px 18px',
                            fontSize: 13,
                        }}
                    >
                        Submit another
                    </button>
                </div>
            </section>
        </>
    );
}
