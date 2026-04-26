import React, { useMemo, useState } from 'react';
import { ThirdParty } from '../../config';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBug,
    faSearch,
    faArrowRight,
    faExternalLinkAlt,
} from '@fortawesome/free-solid-svg-icons';
import { faGithub } from '@fortawesome/free-brands-svg-icons';

function avatarInitials(name: string): string {
    const cleaned = name.replace(/[^A-Za-z0-9]/g, '');
    return cleaned.slice(0, 2) || '??';
}

function ThirdPartyCard({
    name,
    addon,
    tagColors,
    tagDescriptions,
}: {
    name: string;
    addon: ThirdParty['addons'][string];
    tagColors: Record<string, string>;
    tagDescriptions: Record<string, string | undefined>;
}): JSX.Element {
    const firstTag = addon.Tags?.[0];
    const tile = firstTag ? tagColors[firstTag] : 'var(--bb-mute-2)';
    return (
        <article
            className="bb-card"
            style={{
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: tile,
                        display: 'grid',
                        placeItems: 'center',
                        fontFamily: 'var(--bb-display)',
                        fontWeight: 700,
                        fontSize: 16,
                        color: 'var(--bb-ink)',
                        border: '1px solid var(--bb-line)',
                        flexShrink: 0,
                    }}
                    aria-hidden
                >
                    {avatarInitials(name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            fontFamily: 'var(--bb-display)',
                            fontSize: 17,
                            fontWeight: 600,
                            letterSpacing: '-0.01em',
                            color: 'var(--bb-ink)',
                        }}
                    >
                        {name}
                    </div>
                    <div
                        style={{
                            fontSize: 12,
                            color: 'var(--bb-mute)',
                            marginTop: 2,
                        }}
                    >
                        by{' '}
                        {addon.AuthorLink ? (
                            <a
                                href={addon.AuthorLink}
                                target="noopener"
                                style={{
                                    color: 'var(--bb-ink)',
                                    textDecoration: 'underline',
                                    textDecorationColor: 'var(--bb-paper-edge)',
                                }}
                            >
                                {addon.Author}
                            </a>
                        ) : (
                            <span style={{ color: 'var(--bb-ink)' }}>{addon.Author}</span>
                        )}
                    </div>
                </div>
            </div>
            <p
                style={{
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: 'var(--bb-ink-2)',
                    margin: 0,
                }}
            >
                {addon.Description}
            </p>
            {addon.Tags && addon.Tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {addon.Tags.slice()
                        .sort()
                        .map((tag) => (
                            <span
                                key={tag}
                                className="bb-pill"
                                title={tagDescriptions[tag]}
                                style={{ fontSize: 11, padding: '2px 8px' }}
                            >
                                #{tag}
                            </span>
                        ))}
                </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {addon.Releases && (
                    <a
                        href={addon.Releases}
                        target="noopener"
                        className="bb-btn bb-btn-primary"
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            fontSize: 13,
                        }}
                    >
                        <FontAwesomeIcon icon={faArrowRight} />
                        Visit project
                    </a>
                )}
                {addon.Github && (
                    <a
                        href={addon.Github}
                        target="noopener"
                        className="bb-btn bb-btn-ghost"
                        title="Source on GitHub"
                        style={{ padding: '8px 12px', fontSize: 13 }}
                    >
                        <FontAwesomeIcon icon={faGithub} />
                    </a>
                )}
                {addon.Issues && (
                    <a
                        href={addon.Issues}
                        target="noopener"
                        className="bb-btn bb-btn-ghost"
                        title="Report an issue"
                        style={{ padding: '8px 12px', fontSize: 13 }}
                    >
                        <FontAwesomeIcon icon={faBug} />
                    </a>
                )}
                {!addon.Releases && !addon.Github && !addon.Issues && (
                    <a
                        href={'#'}
                        className="bb-btn bb-btn-ghost"
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            fontSize: 13,
                            cursor: 'default',
                            opacity: 0.6,
                        }}
                    >
                        <FontAwesomeIcon icon={faExternalLinkAlt} />
                        No links
                    </a>
                )}
            </div>
        </article>
    );
}

export default function ThirdPartyPage({ data }: { data: ThirdParty }) {
    const [query, setQuery] = useState('');
    const [activeTags, setActiveTags] = useState<string[]>([]);

    const allTagKeys = useMemo(() => Object.keys(data.tags).sort(), [data.tags]);

    const tagColors = useMemo(() => {
        const out: Record<string, string> = {};
        for (const [t, def] of Object.entries(data.tags)) out[t] = def.color;
        return out;
    }, [data.tags]);

    const tagDescriptions = useMemo(() => {
        const out: Record<string, string | undefined> = {};
        for (const [t, def] of Object.entries(data.tags)) out[t] = def.description;
        return out;
    }, [data.tags]);

    const allNames = useMemo(
        () => Object.keys(data.addons).sort(),
        [data.addons],
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return allNames.filter((name) => {
            const a = data.addons[name];
            if (
                activeTags.length > 0 &&
                !activeTags.every((tag) => a.Tags?.includes(tag))
            )
                return false;
            if (!q) return true;
            return (
                name.toLowerCase().includes(q) ||
                a.Author.toLowerCase().includes(q) ||
                a.Description.toLowerCase().includes(q)
            );
        });
    }, [allNames, data.addons, query, activeTags]);

    const toggleTag = (t: string) =>
        setActiveTags((prev) =>
            prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
        );

    return (
        <div style={{ width: '100%' }}>
            {/* ── HERO ────────────────────────────────────────── */}
            <section
                className="bb-mc-bg"
                style={
                    {
                        paddingBottom: 0,
                        ['--bb-hero-image' as string]: "url('/bg-portals.png')",
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
                        Third-party addons
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
                        Community add-ons
                    </h1>
                    <p
                        style={{
                            fontSize: 15,
                            color: 'rgba(255,255,255,0.88)',
                            maxWidth: 680,
                            textShadow: '0 1px 8px rgba(0,0,0,0.4)',
                            margin: 0,
                            paddingBottom: 32,
                        }}
                    >
                        Built and maintained by the community. Listed here as references —
                        install at your own pace, links go to each project.
                    </p>
                </div>
            </section>

            {/* ── PAPER SECTION ───────────────────────────────── */}
            <section
                className="bb-section-pad"
                style={{ background: 'var(--bb-paper)', padding: '32px 28px 80px' }}
            >
                <div style={{ maxWidth: 1180, margin: '0 auto' }}>
                    {/* Search + tag chips */}
                    <div
                        className="bb-card"
                        style={{
                            padding: 16,
                            marginBottom: 24,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                        }}
                    >
                        <div style={{ position: 'relative' }}>
                            <span
                                style={{
                                    position: 'absolute',
                                    left: 14,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--bb-mute)',
                                    pointerEvents: 'none',
                                    fontSize: 14,
                                }}
                            >
                                <FontAwesomeIcon icon={faSearch} />
                            </span>
                            <input
                                type="text"
                                placeholder="Search by name, author, or description…"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px 10px 38px',
                                    border: '1px solid var(--bb-line-strong)',
                                    borderRadius: 8,
                                    background: 'var(--bb-paper-2)',
                                    fontSize: 14,
                                    fontFamily: 'inherit',
                                    color: 'var(--bb-ink)',
                                    outline: 'none',
                                }}
                            />
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 6,
                                alignItems: 'center',
                            }}
                        >
                            <span className="bb-eyebrow" style={{ marginRight: 4 }}>
                                Filter
                            </span>
                            {allTagKeys.map((tag) => {
                                const active = activeTags.includes(tag);
                                return (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => toggleTag(tag)}
                                        title={tagDescriptions[tag]}
                                        className="bb-pill"
                                        style={{
                                            cursor: 'pointer',
                                            background: active
                                                ? 'var(--bb-ink)'
                                                : undefined,
                                            color: active ? 'var(--bb-paper)' : undefined,
                                            border: active
                                                ? '1px solid var(--bb-ink)'
                                                : undefined,
                                            fontSize: 12,
                                        }}
                                    >
                                        #{tag}
                                    </button>
                                );
                            })}
                            {activeTags.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTags([])}
                                    style={{
                                        marginLeft: 6,
                                        background: 'transparent',
                                        border: 0,
                                        color: 'var(--bb-mute)',
                                        fontSize: 12,
                                        cursor: 'pointer',
                                        textDecoration: 'underline',
                                    }}
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Result count */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            justifyContent: 'space-between',
                            marginBottom: 14,
                            flexWrap: 'wrap',
                            gap: 6,
                        }}
                    >
                        <span
                            style={{
                                fontFamily: 'var(--bb-mono)',
                                fontSize: 12,
                                color: 'var(--bb-mute)',
                                letterSpacing: '0.04em',
                            }}
                        >
                            {filtered.length} of {allNames.length} addons
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--bb-mute)' }}>
                            Want yours listed?{' '}
                            <a
                                href="https://github.com/BentoBoxWorld/Downloads"
                                target="noopener"
                                style={{
                                    color: 'var(--bb-ink)',
                                    textDecoration: 'underline',
                                    textDecorationColor: 'var(--bb-paper-edge)',
                                }}
                            >
                                Open a PR &rarr;
                            </a>
                        </span>
                    </div>

                    {/* Cards grid (2-col) */}
                    {filtered.length === 0 ? (
                        <div
                            className="bb-placeholder"
                            style={{ height: 180, marginTop: 16 }}
                        >
                            No addons match — try clearing filters
                        </div>
                    ) : (
                        <div
                            className="bb-grid-2"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                gap: 16,
                            }}
                        >
                            {filtered.map((name) => (
                                <ThirdPartyCard
                                    key={name}
                                    name={name}
                                    addon={data.addons[name]}
                                    tagColors={tagColors}
                                    tagDescriptions={tagDescriptions}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
