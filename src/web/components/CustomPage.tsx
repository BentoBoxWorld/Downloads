import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { useForm } from 'react-hook-form';
import { useLocation } from 'react-router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faDownload,
    faSearch,
    faLink,
    faCheck,
} from '@fortawesome/free-solid-svg-icons';
import { AddonType } from '../../config';

/* ── Number formatting ────────────────────────────────────────── */
function fmtCount(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 10_000) return Math.round(n / 1000) + 'K';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
}

/* ── Version state classification ────────────────────────────── */
type VersionState = 'latest' | 'beta' | 'older';
function versionState(v: string | undefined): VersionState {
    if (v === 'latest') return 'latest';
    if (v === 'beta') return 'beta';
    return 'older';
}

function VersionWarning({ state }: { state: VersionState }): JSX.Element {
    const map: Record<
        VersionState,
        { bg: string; fg: string; label: string }
    > = {
        latest: {
            bg: 'var(--bb-green-soft)',
            fg: 'var(--bb-green-ink)',
            label: 'LATEST · ACTIVELY SUPPORTED',
        },
        beta: {
            bg: 'oklch(0.95 0.06 80)',
            fg: 'var(--bb-amber-ink)',
            label: 'BETA · TEST BUILDS ONLY',
        },
        older: {
            bg: 'oklch(0.95 0.05 25)',
            fg: 'var(--bb-rose)',
            label: 'OLDER · LIMITED SUPPORT',
        },
    };
    const s = map[state];
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 6,
                background: s.bg,
                color: s.fg,
                fontSize: 11,
                fontFamily: 'var(--bb-mono)',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
            }}
        >
            <span
                style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: 'currentColor',
                }}
            />
            {s.label}
        </span>
    );
}

/* ── Stable colour for the addon row colour-stripe ───────────── */
const GAMEMODE_HEX: Record<string, string> = {
    bskyblock: '#ffdd57',
    aoneblock: '#48c774',
    acidisland: '#48c774',
    caveblock: '#a07a4f',
    boxed: '#9aa3b3',
    poseidon: '#3a8cb6',
    skygrid: '#a8d6ee',
    raftmode: '#3a8cb6',
};
function accentForAddon(a: AddonType): string {
    if (a.gamemode) {
        const k = a.name.toLowerCase();
        return GAMEMODE_HEX[k] || '#48c774';
    }
    return 'var(--bb-mute-2)';
}

interface AddonRowProps {
    addon: AddonType;
    enabled: boolean;
    checked: boolean;
    versionLabel: string;
    versionTone: VersionState | 'none';
    inputProps: React.InputHTMLAttributes<HTMLInputElement>;
    isHovered: boolean;
    onHover: () => void;
}

function AddonRow({
    addon,
    enabled,
    checked,
    versionLabel,
    versionTone,
    inputProps,
    isHovered,
    onHover,
}: AddonRowProps): JSX.Element {
    const versionPill = (() => {
        if (versionTone === 'none') {
            return (
                <span
                    style={{
                        fontFamily: 'var(--bb-mono)',
                        fontSize: 11,
                        color: 'var(--bb-mute-2)',
                        minWidth: 56,
                        textAlign: 'right',
                    }}
                >
                    —
                </span>
            );
        }
        const tone =
            versionTone === 'latest'
                ? { bg: 'var(--bb-green-soft)', fg: 'var(--bb-green-ink)' }
                : versionTone === 'beta'
                ? { bg: 'oklch(0.95 0.06 80)', fg: 'var(--bb-amber-ink)' }
                : { bg: 'rgba(207,27,33,0.10)', fg: 'var(--bb-rose)' };
        return (
            <span
                style={{
                    fontFamily: 'var(--bb-mono)',
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: tone.bg,
                    color: tone.fg,
                    textAlign: 'center',
                    minWidth: 56,
                }}
            >
                {versionLabel}
            </span>
        );
    })();

    return (
        <label
            onMouseEnter={onHover}
            style={{
                display: 'grid',
                gridTemplateColumns: '24px 8px 1fr auto auto',
                gap: 12,
                alignItems: 'center',
                padding: '10px 16px',
                borderBottom: '1px solid var(--bb-line)',
                cursor: enabled ? 'pointer' : 'not-allowed',
                opacity: enabled ? 1 : 0.45,
                background: isHovered ? 'rgba(26, 29, 36, 0.03)' : 'transparent',
                transition: 'background 0.1s ease',
            }}
        >
            <input
                type="checkbox"
                className="bb-check"
                checked={checked}
                disabled={!enabled}
                {...inputProps}
            />
            <span
                aria-hidden
                style={{
                    width: 6,
                    height: 24,
                    borderRadius: 3,
                    background: accentForAddon(addon),
                    opacity: 0.85,
                }}
            />
            <span
                style={{
                    minWidth: 0,
                    display: 'inline-flex',
                    alignItems: 'baseline',
                    gap: 8,
                    flexWrap: 'wrap',
                }}
            >
                <span
                    style={{
                        fontFamily: 'var(--bb-display)',
                        fontSize: 15,
                        fontWeight: 600,
                        letterSpacing: '-0.01em',
                        color: 'var(--bb-ink)',
                    }}
                >
                    {addon.name}
                </span>
                <span
                    className="bb-pill"
                    style={{
                        fontSize: 10,
                        padding: '1px 7px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                    }}
                >
                    {addon.gamemode ? 'gamemode' : 'addon'}
                </span>
            </span>
            <span
                title={`${(addon.downloads || 0).toLocaleString()} downloads`}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontFamily: 'var(--bb-mono)',
                    fontSize: 11,
                    color: 'var(--bb-mute)',
                    minWidth: 72,
                    justifyContent: 'flex-end',
                }}
            >
                <FontAwesomeIcon icon={faDownload} />
                <span style={{ color: 'var(--bb-ink)', fontWeight: 500 }}>
                    {fmtCount(addon.downloads || 0)}
                </span>
            </span>
            {versionPill}
        </label>
    );
}

/* ── The page ────────────────────────────────────────────────── */
export default function CustomPage(props: { addonTypes: AddonType[] }) {
    const { addonTypes } = props;
    const { register, getValues, setValue, watch } = useForm();
    const value = (watch('version') as string) || 'latest';
    const watchedAll = watch();

    const [versions, setVersionList] = useState<string[]>([]);
    const [hovered, setHovered] = useState<AddonType | null>(null);
    const [search, setSearch] = useState('');
    const [groupBy, setGroupBy] = useState<'category' | 'flat'>('category');
    const [copied, setCopied] = useState('Copy share URL');
    const queryVersion = useQuery().get('v');

    /* Total downloads — point of pride. */
    const lifetimeDownloads = useMemo(
        () =>
            addonTypes
                .filter((a) => a.name.toLowerCase() !== 'bentobox')
                .reduce((s, a) => s + (a.downloads || 0), 0),
        [addonTypes],
    );

    const selectedAddonNames = useMemo(() => {
        return Object.keys(watchedAll).filter(
            (k) => k !== 'version' && watchedAll[k],
        );
    }, [watchedAll]);

    const selectedDownloadable = useMemo(
        () =>
            selectedAddonNames.filter((name) =>
                Object.keys(
                    addonTypes.find((a) => a.name === name)?.versions || {},
                ).includes(value),
            ),
        [selectedAddonNames, addonTypes, value],
    );

    const selectedDownloads = useMemo(
        () =>
            addonTypes
                .filter((a) => selectedAddonNames.includes(a.name))
                .reduce((s, a) => s + (a.downloads || 0), 0),
        [addonTypes, selectedAddonNames],
    );

    /* Available versions list */
    useEffect(() => {
        const seen: Record<string, true> = {};
        for (const a of addonTypes) {
            for (const v of Object.keys(a.versions)) {
                if (v !== 'latest' && v !== 'beta') seen[v] = true;
            }
        }
        setVersionList(Object.keys(seen));
    }, [addonTypes]);

    /* Hash → preselect addons (preserve original behaviour) */
    useEffect(() => {
        const hash = location.hash;
        if (hash.length < 2) return;
        try {
            const names: string[] = JSON.parse(decodeURI(hash.slice(1)));
            names.forEach((n) => setValue(n, true));
        } catch (e) {
            console.error(e);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ?v= preselects MC version once the list is built */
    useEffect(() => {
        if (queryVersion && versions.includes(queryVersion))
            setValue('version', queryVersion);
    }, [versions, queryVersion, setValue]);

    /* Filtered + grouped addon list (excludes the bentobox row) */
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (
            addonTypes
                .filter((a) => a.name.toLowerCase() !== 'bentobox')
                .filter((a) => !q || a.name.toLowerCase().includes(q))
                // Sort by name rather than trusting the config order: the admin
                // interface appends new addons to the end of the list.
                .sort((a, b) => {
                    if (a.gamemode !== b.gamemode) return a.gamemode ? -1 : 1;
                    return a.name.localeCompare(b.name);
                })
        );
    }, [addonTypes, search]);

    const groups = useMemo(() => {
        if (groupBy === 'category') {
            const out: Record<'gamemode' | 'addon', AddonType[]> = {
                gamemode: [],
                addon: [],
            };
            for (const a of filtered) (a.gamemode ? out.gamemode : out.addon).push(a);
            return out;
        }
        return { all: filtered } as Record<string, AddonType[]>;
    }, [filtered, groupBy]);

    function generate() {
        if (selectedDownloadable.length < 1) return;
        open(
            `/api/generate?downloads=${encodeURI(
                '[' + selectedDownloadable.map((a) => '"' + a + '"').join(',') + ']',
            )}&version=${value}`,
        );
    }

    function copyUrl() {
        navigator.clipboard.writeText(
            `${location.protocol}//${location.host}/custom${
                value === 'latest' ? '' : `?v=${value}`
            }${
                selectedDownloadable.length === 0
                    ? ''
                    : '#' +
                      encodeURI(
                          '[' +
                              selectedDownloadable
                                  .map((a) => '"' + a + '"')
                                  .join(',') +
                              ']',
                      )
            }`,
        );
        setCopied('Copied!');
        setTimeout(() => setCopied('Copy share URL'), 2500);
    }

    const bentoBox = addonTypes.find((a) => a.name.toLowerCase() === 'bentobox');
    const apiPreviewArr =
        '[' + selectedDownloadable.map((s) => `"${s}"`).join(',') + ']';

    const groupOrder: Array<keyof typeof groups> =
        groupBy === 'category' ? ['gamemode', 'addon'] : ['all'];
    const groupLabels: Record<string, string> = {
        gamemode: 'Game modes',
        addon: 'Addons',
        all: 'All addons',
    };

    return (
        <div style={{ width: '100%' }}>
            {/* ── HERO ────────────────────────────────────────── */}
            <section
                className="bb-mc-bg"
                style={
                    {
                        paddingBottom: 0,
                        ['--bb-hero-image' as string]: "url('/bg-boxed.png')",
                    } as React.CSSProperties
                }
            >
                <div
                    className="bb-hero-padding"
                    style={{
                        maxWidth: 1180,
                        margin: '0 auto',
                        padding: '40px 28px 28px',
                    }}
                >
                    <div
                        className="bb-eyebrow"
                        style={{ color: 'rgba(255,255,255,0.7)' }}
                    >
                        Custom build
                    </div>
                    <h1
                        style={{
                            fontFamily: 'var(--bb-display)',
                            fontSize: 40,
                            fontWeight: 700,
                            color: '#fff',
                            margin: '4px 0 6px',
                            letterSpacing: '-0.025em',
                            textShadow: '0 2px 16px rgba(0,0,0,0.4)',
                        }}
                    >
                        Build your bundle
                    </h1>
                    <p
                        style={{
                            fontSize: 15,
                            color: 'rgba(255,255,255,0.88)',
                            maxWidth: 680,
                            textShadow: '0 1px 8px rgba(0,0,0,0.4)',
                            margin: 0,
                        }}
                    >
                        Pick a Minecraft version, then check the addons you want. Hover any
                        row to read what it does. Copy a share URL when you&rsquo;re happy.
                    </p>
                    <div
                        style={{
                            marginTop: 18,
                            marginBottom: 32,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 14,
                            padding: '8px 14px',
                            borderRadius: 999,
                            background: 'rgba(245,241,232,0.92)',
                            border: '1px solid var(--bb-line)',
                        }}
                    >
                        <span
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 11,
                                color: 'var(--bb-mute)',
                                fontFamily: 'var(--bb-mono)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.12em',
                            }}
                        >
                            <FontAwesomeIcon icon={faDownload} /> Lifetime
                        </span>
                        <span
                            style={{
                                fontFamily: 'var(--bb-display)',
                                fontSize: 18,
                                fontWeight: 600,
                                color: 'var(--bb-ink)',
                            }}
                        >
                            {lifetimeDownloads.toLocaleString()}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--bb-mute)' }}>
                            downloads across all addons
                        </span>
                    </div>
                </div>
            </section>

            {/* ── PAPER SECTION ───────────────────────────────── */}
            <section
                className="bb-section-pad"
                style={{ background: 'var(--bb-paper)', padding: '32px 28px 80px' }}
            >
                <div
                    style={{
                        maxWidth: 1180,
                        margin: '0 auto',
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 1fr)',
                        gap: 28,
                        alignItems: 'start',
                    }}
                    className="bb-grid-2"
                >
                    {/* ── LEFT: addon picker ─────────────────── */}
                    <div className="bb-card" style={{ padding: 0, overflow: 'hidden' }}>
                        {/* Toolbar */}
                        <div
                            style={{
                                padding: '14px 18px',
                                borderBottom: '1px solid var(--bb-line)',
                                display: 'flex',
                                gap: 12,
                                alignItems: 'center',
                            }}
                        >
                            <div style={{ flex: 1, position: 'relative' }}>
                                <span
                                    style={{
                                        position: 'absolute',
                                        left: 12,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: 'var(--bb-mute)',
                                        pointerEvents: 'none',
                                        fontSize: 13,
                                    }}
                                >
                                    <FontAwesomeIcon icon={faSearch} />
                                </span>
                                <input
                                    type="text"
                                    placeholder="Filter addons…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px 8px 34px',
                                        border: '1px solid var(--bb-line-strong)',
                                        borderRadius: 8,
                                        background: 'var(--bb-paper-2)',
                                        fontSize: 13,
                                        fontFamily: 'inherit',
                                        color: 'var(--bb-ink)',
                                        outline: 'none',
                                    }}
                                />
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    gap: 4,
                                    padding: 3,
                                    background: 'var(--bb-paper-2)',
                                    borderRadius: 8,
                                }}
                            >
                                {(
                                    [
                                        ['category', 'Category'],
                                        ['flat', 'Flat'],
                                    ] as Array<['category' | 'flat', string]>
                                ).map(([k, l]) => (
                                    <button
                                        key={k}
                                        type="button"
                                        onClick={() => setGroupBy(k)}
                                        style={{
                                            padding: '6px 10px',
                                            border: 0,
                                            borderRadius: 6,
                                            background:
                                                groupBy === k
                                                    ? 'var(--bb-paper)'
                                                    : 'transparent',
                                            color: 'var(--bb-ink)',
                                            fontSize: 12,
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            boxShadow:
                                                groupBy === k ? 'var(--sh-1)' : 'none',
                                        }}
                                    >
                                        {l}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Grouped list */}
                        <div>
                            {groupOrder.map((group) => {
                                const items = (groups as Record<string, AddonType[]>)[group];
                                if (!items || !items.length) return null;
                                return (
                                    <div key={group}>
                                        {groupBy === 'category' && (
                                            <div
                                                style={{
                                                    padding: '14px 18px 6px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                }}
                                            >
                                                <span className="bb-eyebrow">
                                                    {groupLabels[group]}
                                                </span>
                                                <span
                                                    style={{
                                                        fontFamily: 'var(--bb-mono)',
                                                        fontSize: 11,
                                                        color: 'var(--bb-mute-2)',
                                                    }}
                                                >
                                                    {items.length} addons
                                                </span>
                                            </div>
                                        )}
                                        {items.map((a) => {
                                            const enabled = Object.keys(a.versions).includes(
                                                value,
                                            );
                                            const checked = !!watchedAll[a.name];
                                            const rawVersion = a.versions[value];
                                            let versionTone: VersionState | 'none' = 'none';
                                            let label = '—';
                                            if (rawVersion) {
                                                if (value === 'beta') {
                                                    versionTone = 'beta';
                                                    label = 'b-' + rawVersion;
                                                } else if (value === 'latest') {
                                                    versionTone = 'latest';
                                                    label = 'v' + rawVersion;
                                                } else {
                                                    versionTone = 'older';
                                                    label = 'v' + rawVersion;
                                                }
                                            }
                                            return (
                                                <AddonRow
                                                    key={a.name}
                                                    addon={a}
                                                    enabled={enabled}
                                                    checked={checked}
                                                    versionLabel={label}
                                                    versionTone={versionTone}
                                                    isHovered={hovered?.name === a.name}
                                                    onHover={() => setHovered(a)}
                                                    inputProps={{
                                                        ...register(a.name),
                                                    }}
                                                />
                                            );
                                        })}
                                    </div>
                                );
                            })}
                            {filtered.length === 0 && (
                                <div
                                    className="bb-placeholder"
                                    style={{ height: 120, margin: 18 }}
                                >
                                    No addons match — try clearing the filter.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── RIGHT: sticky info / actions ───────── */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16,
                            position: 'sticky',
                            top: 88,
                        }}
                    >
                        {/* Version + warning */}
                        <div className="bb-card" style={{ padding: 18 }}>
                            <div className="bb-eyebrow" style={{ marginBottom: 8 }}>
                                Minecraft version
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    gap: 10,
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                }}
                            >
                                <select
                                    {...register('version', { required: true })}
                                    style={{
                                        flex: 1,
                                        minWidth: 140,
                                        padding: '10px 12px',
                                        borderRadius: 8,
                                        border: '1px solid var(--bb-line-strong)',
                                        background: 'var(--bb-paper-2)',
                                        fontFamily: 'var(--bb-mono)',
                                        fontSize: 14,
                                        color: 'var(--bb-ink)',
                                    }}
                                >
                                    <option value="latest">Latest</option>
                                    <option value="beta">CI (Beta)</option>
                                    {versions
                                        .slice()
                                        .sort((a, b) => {
                                            const pa = a.split('.').map(Number);
                                            const pb = b.split('.').map(Number);
                                            for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
                                                const d = (pb[i] || 0) - (pa[i] || 0);
                                                if (d !== 0) return d;
                                            }
                                            return 0;
                                        })
                                        .map((v) => (
                                            <option key={v} value={v}>
                                                {v}
                                            </option>
                                        ))}
                                </select>
                                <VersionWarning state={versionState(value)} />
                            </div>
                            <div
                                style={{
                                    marginTop: 10,
                                    fontSize: 12,
                                    color: 'var(--bb-mute)',
                                }}
                            >
                                BentoBox core{' '}
                                <span
                                    style={{
                                        fontFamily: 'var(--bb-mono)',
                                        color: 'var(--bb-ink)',
                                    }}
                                >
                                    {value === 'beta' && 'b-'}
                                    {bentoBox?.versions[value] || '—'}
                                </span>
                            </div>
                        </div>

                        {/* Description preview */}
                        <div className="bb-card" style={{ padding: 18 }}>
                            <div className="bb-eyebrow" style={{ marginBottom: 8 }}>
                                Description
                            </div>
                            {hovered ? (
                                <>
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            flexWrap: 'wrap',
                                        }}
                                    >
                                        <span
                                            aria-hidden
                                            style={{
                                                width: 8,
                                                height: 24,
                                                borderRadius: 3,
                                                background: accentForAddon(hovered),
                                            }}
                                        />
                                        <span
                                            style={{
                                                fontFamily: 'var(--bb-display)',
                                                fontSize: 18,
                                                fontWeight: 600,
                                                letterSpacing: '-0.01em',
                                                color: 'var(--bb-ink)',
                                            }}
                                        >
                                            {hovered.name}
                                        </span>
                                        <span
                                            className="bb-pill"
                                            style={{
                                                fontSize: 10,
                                                padding: '1px 7px',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.08em',
                                            }}
                                        >
                                            {hovered.gamemode ? 'gamemode' : 'addon'}
                                        </span>
                                    </div>
                                    <div
                                        style={{
                                            display: 'flex',
                                            gap: 16,
                                            marginTop: 10,
                                            fontFamily: 'var(--bb-mono)',
                                            fontSize: 11,
                                            color: 'var(--bb-mute)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.06em',
                                            flexWrap: 'wrap',
                                        }}
                                    >
                                        <span>
                                            <FontAwesomeIcon icon={faDownload} />{' '}
                                            <span style={{ color: 'var(--bb-ink)' }}>
                                                {(hovered.downloads || 0).toLocaleString()}
                                            </span>{' '}
                                            downloads
                                        </span>
                                        <span>
                                            Latest{' '}
                                            <span style={{ color: 'var(--bb-ink)' }}>
                                                {hovered.versions.latest
                                                    ? 'v' + hovered.versions.latest
                                                    : '—'}
                                            </span>
                                        </span>
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 14,
                                            lineHeight: 1.55,
                                            color: 'var(--bb-ink-2)',
                                            margin: '12px 0 0',
                                        }}
                                    >
                                        <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                                            {hovered.description}
                                        </ReactMarkdown>
                                    </div>
                                </>
                            ) : (
                                <p
                                    style={{
                                        fontSize: 13,
                                        color: 'var(--bb-mute)',
                                        margin: 0,
                                    }}
                                >
                                    Hover an addon to see what it does.
                                </p>
                            )}
                        </div>

                        {/* Your bundle */}
                        <div
                            className="bb-card bb-card-elev"
                            style={{ padding: 18 }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'baseline',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: 6,
                                }}
                            >
                                <span className="bb-eyebrow">Your bundle</span>
                                <span
                                    style={{
                                        fontFamily: 'var(--bb-mono)',
                                        fontSize: 11,
                                        color: 'var(--bb-mute)',
                                    }}
                                >
                                    {selectedAddonNames.length} addons ·{' '}
                                    <span style={{ color: 'var(--bb-ink)' }}>
                                        {selectedDownloads.toLocaleString()}
                                    </span>{' '}
                                    total dl
                                </span>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 4,
                                    marginTop: 10,
                                    minHeight: 24,
                                }}
                            >
                                {selectedAddonNames.length === 0 && (
                                    <span
                                        style={{
                                            fontSize: 13,
                                            color: 'var(--bb-mute)',
                                        }}
                                    >
                                        Pick at least one addon to enable downloads.
                                    </span>
                                )}
                                {selectedAddonNames.map((name) => {
                                    const a = addonTypes.find((x) => x.name === name);
                                    if (!a) return null;
                                    return (
                                        <span
                                            key={name}
                                            className="bb-pill"
                                            style={{
                                                fontSize: 11,
                                                padding: '2px 8px',
                                                display: 'inline-flex',
                                                gap: 6,
                                                alignItems: 'center',
                                            }}
                                        >
                                            <span
                                                style={{
                                                    width: 6,
                                                    height: 6,
                                                    borderRadius: 999,
                                                    background: accentForAddon(a),
                                                }}
                                            />
                                            {name}
                                        </span>
                                    );
                                })}
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                                <button
                                    type="button"
                                    onClick={generate}
                                    disabled={selectedDownloadable.length === 0}
                                    className="bb-btn bb-btn-primary"
                                    style={{
                                        flex: 1,
                                        opacity:
                                            selectedDownloadable.length === 0 ? 0.5 : 1,
                                        cursor:
                                            selectedDownloadable.length === 0
                                                ? 'not-allowed'
                                                : 'pointer',
                                    }}
                                >
                                    <FontAwesomeIcon icon={faDownload} />
                                    Generate ZIP
                                </button>
                                <button
                                    type="button"
                                    onClick={copyUrl}
                                    className="bb-btn bb-btn-ghost"
                                    title="Copy share URL"
                                >
                                    <FontAwesomeIcon
                                        icon={copied === 'Copied!' ? faCheck : faLink}
                                    />
                                    {copied}
                                </button>
                            </div>
                            <div
                                style={{
                                    marginTop: 10,
                                    padding: 10,
                                    background: 'var(--bb-paper-2)',
                                    borderRadius: 6,
                                    fontFamily: 'var(--bb-mono)',
                                    fontSize: 11,
                                    color: 'var(--bb-mute)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                                title={`/api/generate?downloads=${apiPreviewArr}&version=${value}`}
                            >
                                /api/generate?downloads={apiPreviewArr}&amp;version={value}
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

function useQuery() {
    return new URLSearchParams(useLocation().search);
}
