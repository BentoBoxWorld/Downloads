import React, { useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { setPendingBlueprint } from '../pendingBlueprint';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faDownload,
    faSearch,
    faArrowDown,
    faTimes,
    faLayerGroup,
    faUpload,
} from '@fortawesome/free-solid-svg-icons';
import {
    BlueprintCatalog,
    BlueprintCatalogGameMode,
    BlueprintEntry,
} from '../../config';
import {
    BlueprintFileUrl,
    BlueprintGameModeZipUrl,
    BlueprintZipUrl,
} from '../ApiRequestManager';
import VoxelStack, { variantFor } from './VoxelStack';

function humanSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function shortMaterial(mat: string): string {
    return (mat || '').replace(/^minecraft:/, '').replace(/_/g, ' ');
}

/* "X minutes ago" — based on `generatedAt` (unix ms) from the catalog. */
function timeAgo(ms: number): string {
    const diff = Date.now() - ms;
    if (diff < 60_000) return 'just now';
    const m = Math.round(diff / 60_000);
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24);
    return `${d} d ago`;
}

function BlueprintCard({
    bp,
    gameModeInfo,
    selected,
    onToggle,
    expanded,
    onHover,
    tagColors,
}: {
    bp: BlueprintEntry;
    gameModeInfo?: BlueprintCatalogGameMode;
    selected: boolean;
    onToggle: () => void;
    expanded: boolean;
    onHover: (id: string | null) => void;
    tagColors: Record<string, string>;
}) {
    const gameModeLabel = gameModeInfo?.displayName || bp.gameMode;
    const dims = `${bp.stats.dimensions.x} × ${bp.stats.dimensions.y} × ${bp.stats.dimensions.z}`;

    return (
        <article
            onMouseEnter={() => onHover(bp.id)}
            onMouseLeave={() => onHover(null)}
            style={{
                position: 'relative',
                background: '#0c2038',
                border: `1px solid ${selected ? 'var(--bp-accent)' : 'var(--bp-line)'}`,
                borderRadius: 14,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
                transform: expanded ? 'translateY(-2px)' : 'none',
                boxShadow: expanded ? '0 18px 40px -16px rgba(0,0,0,0.6)' : 'none',
            }}
        >
            {/* Image / placeholder area */}
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

                {/* Top row: select + dimensions */}
                <div
                    style={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        right: 10,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        zIndex: 2,
                    }}
                >
                    <label
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 10px',
                            borderRadius: 999,
                            background: 'rgba(10,29,51,0.85)',
                            border: '1px solid var(--bp-line)',
                            fontSize: 11,
                            fontFamily: 'var(--bb-mono)',
                            color: 'var(--bp-ink)',
                            cursor: 'pointer',
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={selected}
                            onChange={onToggle}
                            style={{ accentColor: 'var(--bp-accent)' }}
                        />
                        Select
                    </label>
                    <span className="bp-chip">{dims}</span>
                </div>

                {bp.stats.sinking && (
                    <div style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 2 }}>
                        <span className="bp-chip" style={{ color: '#a8d6ee' }}>
                            <FontAwesomeIcon icon={faArrowDown} style={{ fontSize: 9 }} /> Sinking
                        </span>
                    </div>
                )}

                {/* Image override if curator supplied one, else CSS-only voxel preview. */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'grid',
                        placeItems: 'center',
                        zIndex: 1,
                    }}
                >
                    {bp.image ? (
                        <img
                            src={`/blueprints/images/${bp.image}`}
                            alt={bp.displayName}
                            style={{
                                maxWidth: '85%',
                                maxHeight: 140,
                                borderRadius: 8,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                            }}
                        />
                    ) : (
                        <VoxelStack
                            topBlocks={bp.stats.topBlocks}
                            variant={variantFor(bp.stats.dimensions)}
                            width={260}
                            height={150}
                        />
                    )}
                </div>
            </div>

            {/* Body */}
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
                        }}
                    >
                        {bp.displayName}
                    </div>
                    <a
                        href={BlueprintFileUrl(bp.id)}
                        title={`Download ${bp.displayName}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: 'var(--bp-ink-soft)', display: 'inline-flex' }}
                    >
                        <FontAwesomeIcon icon={faDownload} style={{ fontSize: 14 }} />
                    </a>
                </div>
                <div
                    style={{
                        fontSize: 12,
                        color: 'var(--bp-ink-soft)',
                        marginTop: 2,
                        fontFamily: 'var(--bb-mono)',
                    }}
                >
                    {gameModeLabel}
                    {bp.author ? (
                        <>
                            {' · '}
                            {bp.authorLink ? (
                                <a
                                    href={bp.authorLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: 'var(--bp-ink-soft)' }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {bp.author}
                                </a>
                            ) : (
                                bp.author
                            )}
                        </>
                    ) : null}
                </div>

                {bp.description.length > 0 && (
                    <p
                        style={{
                            fontSize: 13,
                            lineHeight: 1.5,
                            color: 'var(--bp-ink)',
                            margin: '10px 0 0',
                            opacity: 0.92,
                        }}
                    >
                        {bp.description.join(' ')}
                    </p>
                )}

                {/* Quick-stat strip */}
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
                    <Stat label="Blocks" value={bp.stats.blockCount.toLocaleString()} />
                    <Stat label="Entities" value={bp.stats.entityCount.toString()} />
                    <Stat label="File" value={humanSize(bp.sizeBytes)} />
                </div>

                {/* Hover-expanded detail */}
                {expanded && (
                    <div
                        style={{
                            marginTop: 12,
                            paddingTop: 12,
                            borderTop: '1px solid var(--bp-line)',
                            animation: 'bpFade 0.15s ease',
                        }}
                    >
                        {bp.stats.topBlocks.length > 0 && (
                            <>
                                <SectionLabel>Top blocks</SectionLabel>
                                <div
                                    style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 4,
                                        marginBottom: 10,
                                    }}
                                >
                                    {bp.stats.topBlocks.slice(0, 5).map((b) => (
                                        <span key={b.material} className="bp-chip">
                                            {shortMaterial(b.material)} × {b.count}
                                        </span>
                                    ))}
                                </div>
                            </>
                        )}
                        {bp.stats.topEntities.length > 0 && (
                            <>
                                <SectionLabel>Entities</SectionLabel>
                                <div
                                    style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 4,
                                        marginBottom: 10,
                                    }}
                                >
                                    {bp.stats.topEntities.map((e) => (
                                        <span
                                            key={e.type}
                                            className="bp-chip"
                                            style={{
                                                background: 'rgba(165, 124, 200, 0.18)',
                                                color: '#d6c0eb',
                                            }}
                                        >
                                            {shortMaterial(e.type)} × {e.count}
                                        </span>
                                    ))}
                                </div>
                            </>
                        )}
                        {bp.stats.biomes.length > 0 && (
                            <>
                                <SectionLabel>Biomes</SectionLabel>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {bp.stats.biomes.map((b) => (
                                        <span key={b} className="bp-chip solid">
                                            {shortMaterial(b)}
                                        </span>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Tags + license */}
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
                        {(bp.tags || []).sort().map((t) => (
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
                        ))}
                    </div>
                    {bp.license && (
                        <span
                            style={{
                                fontSize: 10,
                                color: 'var(--bp-ink-soft)',
                                fontFamily: 'var(--bb-mono)',
                            }}
                        >
                            {bp.license}
                        </span>
                    )}
                </div>
            </div>
        </article>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
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

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                fontSize: 10,
                color: 'var(--bp-ink-soft)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 6,
            }}
        >
            {children}
        </div>
    );
}

function UploadCard(): JSX.Element {
    const [drag, setDrag] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const history = useHistory();

    const handFile = (file: File | null | undefined) => {
        if (!file) return;
        setPendingBlueprint(file);
        history.push('/submit');
    };

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
                handFile(e.dataTransfer.files?.[0]);
            }}
            style={{
                position: 'relative',
                borderRadius: 14,
                background: drag ? 'rgba(127,179,204,0.10)' : 'rgba(10, 29, 51, 0.55)',
                border: `1.5px dashed ${drag ? 'var(--bp-accent)' : 'var(--bp-line-strong)'}`,
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                minHeight: 380,
                color: 'var(--bp-ink)',
                cursor: 'pointer',
                transition: 'background 0.15s ease, border-color 0.15s ease',
            }}
        >
            <input
                ref={inputRef}
                type="file"
                accept=".blueprint"
                style={{ display: 'none' }}
                onChange={(e) => {
                    handFile(e.target.files?.[0]);
                    e.target.value = '';
                }}
            />
            <div
                style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    background: 'rgba(127,179,204,0.10)',
                    border: '1px solid var(--bp-line-strong)',
                    display: 'grid',
                    placeItems: 'center',
                    marginBottom: 14,
                }}
            >
                <FontAwesomeIcon
                    icon={faUpload}
                    style={{ fontSize: 22, color: 'var(--bp-ink)' }}
                />
            </div>
            <div
                style={{
                    fontFamily: 'var(--bb-display)',
                    fontSize: 18,
                    fontWeight: 600,
                    color: '#fff',
                    letterSpacing: '-0.01em',
                }}
            >
                Submit your blueprint
            </div>
            <div
                style={{
                    fontSize: 13,
                    color: 'var(--bp-ink-soft)',
                    marginTop: 6,
                    lineHeight: 1.5,
                    maxWidth: 240,
                }}
            >
                Drop a{' '}
                <code
                    style={{
                        fontFamily: 'var(--bb-mono)',
                        background: 'rgba(127,179,204,0.10)',
                        padding: '1px 4px',
                        borderRadius: 3,
                    }}
                >
                    .blueprint
                </code>{' '}
                file here. We&rsquo;ll parse it, you fill in the metadata, and we open a PR for
                review.
            </div>
            <span
                className="bb-btn bb-btn-paper"
                style={{
                    marginTop: 16,
                    padding: '10px 16px',
                    fontSize: 13,
                    pointerEvents: 'none',
                }}
            >
                <FontAwesomeIcon icon={faUpload} style={{ fontSize: 12 }} />
                Choose file
            </span>
            <div
                style={{
                    fontSize: 11,
                    color: 'var(--bp-ink-soft)',
                    marginTop: 10,
                    fontFamily: 'var(--bb-mono)',
                }}
            >
                max 5 MB · sign in with Discord
            </div>
        </div>
    );
}

function ToggleChip({
    active,
    onClick,
    swatch,
    children,
}: {
    active: boolean;
    onClick: () => void;
    swatch?: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 999,
                border: `1px solid ${active ? 'var(--bp-accent)' : 'var(--bp-line)'}`,
                background: active ? 'rgba(127,179,204,0.16)' : 'rgba(10,29,51,0.5)',
                color: active ? '#fff' : 'var(--bp-ink-soft)',
                fontSize: 12,
                fontFamily: 'var(--bb-sans)',
                cursor: 'pointer',
                transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
            }}
        >
            {swatch && (
                <span
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: swatch,
                    }}
                />
            )}
            {children}
        </button>
    );
}

export default function BlueprintsPage({ data }: { data: BlueprintCatalog }) {
    const [search, setSearch] = useState('');
    const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
    const [gameModeFilter, setGameModeFilter] = useState<string>('all');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [hoverId, setHoverId] = useState<string | null>(null);

    const tagColors = useMemo(() => {
        const out: Record<string, string> = {};
        for (const [name, tag] of Object.entries(data.tags || {})) out[name] = tag.color;
        return out;
    }, [data.tags]);

    const allTags = useMemo(() => {
        const s = new Set<string>();
        data.blueprints.forEach((b) => (b.tags || []).forEach((t) => s.add(t)));
        return [...s].sort();
    }, [data.blueprints]);

    const allModes = useMemo(() => {
        const s = new Set<string>();
        data.blueprints.forEach((b) => s.add(b.gameMode));
        return [...s].sort();
    }, [data.blueprints]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return data.blueprints.filter((bp) => {
            if (gameModeFilter !== 'all' && bp.gameMode !== gameModeFilter) return false;
            if (activeTags.size && !(bp.tags || []).some((t) => activeTags.has(t))) return false;
            if (!q) return true;
            return (
                bp.displayName.toLowerCase().includes(q) ||
                bp.description.join(' ').toLowerCase().includes(q) ||
                bp.gameMode.toLowerCase().includes(q) ||
                (bp.author || '').toLowerCase().includes(q) ||
                (bp.tags || []).some((t) => t.toLowerCase().includes(q))
            );
        });
    }, [data.blueprints, gameModeFilter, activeTags, search]);

    function toggleSelect(id: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function toggleTag(t: string) {
        setActiveTags((prev) => {
            const next = new Set(prev);
            if (next.has(t)) next.delete(t);
            else next.add(t);
            return next;
        });
    }

    function clearFilters() {
        setSearch('');
        setActiveTags(new Set());
        setGameModeFilter('all');
    }

    const filterBaseline = search === '' && activeTags.size === 0 && gameModeFilter === 'all';

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bp-paper-2)' }}>
            {/* ── Hero band ─────────────────────────────────────── */}
            <section
                className="bp-paper with-grid"
                style={{ padding: '40px 28px 56px', position: 'relative' }}
            >
                <div
                    style={{
                        maxWidth: 1180,
                        margin: '0 auto',
                        position: 'relative',
                        zIndex: 1,
                    }}
                >
                    <div
                        className="bb-grid-2"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1.6fr 1fr',
                            alignItems: 'flex-end',
                            gap: 24,
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
                                    color: 'var(--bp-ink-soft)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.14em',
                                    marginBottom: 10,
                                }}
                            >
                                <FontAwesomeIcon icon={faLayerGroup} style={{ fontSize: 11 }} />
                                Sheet 01 · Island Blueprints
                            </div>
                            <h1
                                style={{
                                    fontFamily: 'var(--bb-display)',
                                    fontSize: 52,
                                    fontWeight: 700,
                                    color: '#fff',
                                    margin: 0,
                                    letterSpacing: '-0.025em',
                                    lineHeight: 1.05,
                                }}
                            >
                                Drop-in starter islands.
                            </h1>
                            <p
                                style={{
                                    fontSize: 16,
                                    lineHeight: 1.55,
                                    color: 'var(--bp-ink)',
                                    marginTop: 12,
                                    maxWidth: 620,
                                    opacity: 0.92,
                                }}
                            >
                                Community-made{' '}
                                <code style={{ fontFamily: 'var(--bb-mono)' }}>.blueprint</code>{' '}
                                and bundle files for any BentoBox game mode. Curated from{' '}
                                <a
                                    href="https://github.com/BentoBoxWorld/weblink"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        fontFamily: 'var(--bb-mono)',
                                        color: 'var(--bp-ink)',
                                    }}
                                >
                                    BentoBoxWorld/weblink
                                </a>
                                . Want to add yours?{' '}
                                <a
                                    href="/submit"
                                    style={{
                                        color: 'var(--bp-ink)',
                                        textDecoration: 'underline',
                                        textDecorationColor: 'var(--bp-line-strong)',
                                    }}
                                >
                                    Submit a blueprint
                                </a>
                                .
                            </p>
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                gap: 6,
                                fontFamily: 'var(--bb-mono)',
                                fontSize: 11,
                                color: 'var(--bp-ink-soft)',
                                textAlign: 'right',
                            }}
                        >
                            <span>
                                {data.blueprints.length} blueprints · {allModes.length} game modes
                            </span>
                            <span>updated {timeAgo(data.generatedAt)}</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Filter rail + grid ─────────────────────────────── */}
            <section style={{ padding: '24px 28px 96px' }}>
                <div
                    style={{
                        maxWidth: 1180,
                        margin: '0 auto',
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 240px) minmax(0, 1fr)',
                        gap: 28,
                    }}
                    className="bb-grid-2"
                >
                    {/* Filter rail */}
                    <aside
                        style={{
                            color: 'var(--bp-ink)',
                            position: 'sticky',
                            top: 80,
                            alignSelf: 'start',
                        }}
                    >
                        <div style={{ position: 'relative', marginBottom: 18 }}>
                            <FontAwesomeIcon
                                icon={faSearch}
                                style={{
                                    position: 'absolute',
                                    left: 12,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--bp-ink-soft)',
                                    fontSize: 13,
                                    pointerEvents: 'none',
                                }}
                            />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search…"
                                style={{
                                    width: '100%',
                                    padding: '10px 12px 10px 34px',
                                    background: 'rgba(10,29,51,0.6)',
                                    border: '1px solid var(--bp-line-strong)',
                                    borderRadius: 'var(--r-md)',
                                    color: 'var(--bp-ink)',
                                    fontFamily: 'var(--bb-sans)',
                                    fontSize: 13,
                                    outline: 'none',
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: 18 }}>
                            <SectionLabel>Game mode</SectionLabel>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                <ToggleChip
                                    active={gameModeFilter === 'all'}
                                    onClick={() => setGameModeFilter('all')}
                                >
                                    All
                                </ToggleChip>
                                {allModes.map((gm) => (
                                    <ToggleChip
                                        key={gm}
                                        active={gameModeFilter === gm}
                                        onClick={() =>
                                            setGameModeFilter(gameModeFilter === gm ? 'all' : gm)
                                        }
                                    >
                                        {data.gameModes[gm]?.displayName || gm}
                                    </ToggleChip>
                                ))}
                            </div>
                            {gameModeFilter !== 'all' && (
                                <a
                                    href={BlueprintGameModeZipUrl(gameModeFilter)}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        marginTop: 10,
                                        fontSize: 12,
                                        fontFamily: 'var(--bb-mono)',
                                        color: 'var(--bp-ink)',
                                        textDecoration: 'underline',
                                        textDecorationColor: 'var(--bp-line-strong)',
                                    }}
                                >
                                    <FontAwesomeIcon icon={faDownload} style={{ fontSize: 11 }} />
                                    Download all
                                </a>
                            )}
                        </div>

                        {allTags.length > 0 && (
                            <div style={{ marginBottom: 18 }}>
                                <SectionLabel>Tags</SectionLabel>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {allTags.map((t) => (
                                        <ToggleChip
                                            key={t}
                                            active={activeTags.has(t)}
                                            onClick={() => toggleTag(t)}
                                            swatch={tagColors[t]}
                                        >
                                            {t}
                                        </ToggleChip>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!filterBaseline && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: 0,
                                    color: 'var(--bp-ink-soft)',
                                    fontSize: 12,
                                    fontFamily: 'var(--bb-sans)',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                }}
                            >
                                Clear filters
                            </button>
                        )}
                    </aside>

                    {/* Card grid (UploadCard always sits first so users notice it) */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                            gap: 16,
                            alignContent: 'start',
                        }}
                    >
                        <UploadCard />
                        {filtered.length === 0 ? (
                            <div
                                style={{
                                    padding: '48px 24px',
                                    textAlign: 'center',
                                    background: 'rgba(10, 29, 51, 0.6)',
                                    border: '1px dashed var(--bp-line-strong)',
                                    borderRadius: 14,
                                    color: 'var(--bp-ink-soft)',
                                    fontSize: 14,
                                    gridColumn: '1 / -1',
                                }}
                            >
                                No blueprints match those filters.
                            </div>
                        ) : (
                            filtered.map((bp) => (
                                <BlueprintCard
                                    key={bp.id}
                                    bp={bp}
                                    gameModeInfo={data.gameModes[bp.gameMode]}
                                    selected={selected.has(bp.id)}
                                    onToggle={() => toggleSelect(bp.id)}
                                    expanded={hoverId === bp.id}
                                    onHover={setHoverId}
                                    tagColors={tagColors}
                                />
                            ))
                        )}
                    </div>
                </div>
            </section>

            {/* ── Sticky selection bar ───────────────────────────── */}
            {selected.size > 0 && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 24,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 100,
                        background: 'var(--bp-paper)',
                        border: '1px solid var(--bp-line-strong)',
                        borderRadius: 999,
                        boxShadow: '0 18px 40px -8px rgba(0,0,0,0.6)',
                        padding: '8px 8px 8px 18px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 12,
                        color: 'var(--bp-ink)',
                        fontFamily: 'var(--bb-sans)',
                        fontSize: 13,
                    }}
                >
                    <span>
                        <span style={{ fontFamily: 'var(--bb-mono)', color: '#fff' }}>
                            {selected.size}
                        </span>{' '}
                        selected
                    </span>
                    <a
                        href={BlueprintZipUrl([...selected])}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 14px',
                            borderRadius: 999,
                            background: 'var(--bp-ink)',
                            color: 'var(--bp-paper)',
                            fontSize: 13,
                            fontWeight: 600,
                            textDecoration: 'none',
                        }}
                    >
                        <FontAwesomeIcon icon={faDownload} style={{ fontSize: 11 }} />
                        Download ZIP
                    </a>
                    <button
                        type="button"
                        onClick={() => setSelected(new Set())}
                        title="Clear selection"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--bp-ink-soft)',
                            cursor: 'pointer',
                            padding: 6,
                            display: 'inline-flex',
                            alignItems: 'center',
                        }}
                    >
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
            )}
        </div>
    );
}
