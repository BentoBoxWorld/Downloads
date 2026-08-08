import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCube,
    faWrench,
    faPuzzlePiece,
    faLayerGroup,
    faCheck,
    faArrowRight,
    faHeart,
} from '@fortawesome/free-solid-svg-icons';
import PresetsPage from './PresetsPage';
import { PresetsEntity } from '../../config';

interface LandingProps {
    presets: PresetsEntity[];
}

function ReasonBullet({ children }: { children: React.ReactNode }) {
    return (
        <li
            style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                padding: '12px 0',
                borderBottom: '1px solid var(--bb-line)',
            }}
        >
            <span
                style={{
                    marginTop: 3,
                    width: 20,
                    height: 20,
                    borderRadius: 5,
                    background: 'var(--bb-green-soft)',
                    color: 'var(--bb-green-ink)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    fontSize: 11,
                }}
            >
                <FontAwesomeIcon icon={faCheck} />
            </span>
            <span style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--bb-ink-2)' }}>
                {children}
            </span>
        </li>
    );
}

function StatCell({
    label,
    value,
    sub,
    last,
}: {
    label: string;
    value: string;
    sub?: string;
    last?: boolean;
}) {
    return (
        <div
            style={{
                padding: '20px 24px',
                borderRight: last ? 'none' : '1px solid var(--bb-line)',
            }}
        >
            <div className="bb-eyebrow" style={{ marginBottom: 6 }}>
                {label}
            </div>
            <div
                style={{
                    fontFamily: 'var(--bb-display)',
                    fontSize: 28,
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.1,
                }}
            >
                {value}
            </div>
            {sub && (
                <div style={{ fontSize: 12, color: 'var(--bb-mute)', marginTop: 2 }}>{sub}</div>
            )}
        </div>
    );
}

export default function Landing({ presets }: LandingProps) {
    const { hash } = useLocation();

    function scrollToPresets(e: React.MouseEvent) {
        e.preventDefault();
        const el = document.getElementById('presets-anchor');
        if (el) {
            const top = el.getBoundingClientRect().top + window.scrollY - 60;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    }

    /* When the user navigates here from another route via /#presets-anchor,
     * scroll on mount/hash-change. The 60px offset clears the sticky header. */
    useEffect(() => {
        if (!hash) return;
        const id = hash.startsWith('#') ? hash.slice(1) : hash;
        const tryScroll = () => {
            const el = document.getElementById(id);
            if (!el) return false;
            const top = el.getBoundingClientRect().top + window.scrollY - 60;
            window.scrollTo({ top, behavior: 'smooth' });
            return true;
        };
        if (tryScroll()) return;
        const t = setTimeout(tryScroll, 80);
        return () => clearTimeout(t);
    }, [hash]);

    return (
        <div style={{ width: '100%' }}>
            {/* ── HERO ───────────────────────────────────────────────── */}
            <section
                className="bb-mc-bg"
                style={{ ['--bb-hero-image' as string]: "url('/bg-skyblock.jpg')" } as React.CSSProperties}
            >
                <div
                    className="bb-hero-padding"
                    style={{
                        maxWidth: 1180,
                        margin: '0 auto',
                        padding: '40px 28px 56px',
                    }}
                >
                    <div
                        className="bb-hero-stack"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1.15fr 0.85fr',
                            gap: 48,
                            alignItems: 'center',
                            paddingTop: 40,
                        }}
                    >
                        {/* Left: copy */}
                        <div>
                            <div
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '6px 14px',
                                    borderRadius: 999,
                                    background: 'rgba(245, 241, 232, 0.92)',
                                    border: '1px solid var(--bb-line)',
                                    fontSize: 12,
                                    color: 'var(--bb-ink)',
                                    marginBottom: 24,
                                    fontWeight: 500,
                                }}
                            >
                                <span
                                    style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: 999,
                                        background: 'var(--bb-green)',
                                    }}
                                />
                                Powering 1,300+ servers worldwide
                            </div>
                            <h1
                                className="bb-hero-title"
                                style={{
                                    fontFamily: 'var(--bb-display)',
                                    fontSize: 68,
                                    fontWeight: 700,
                                    lineHeight: 1.02,
                                    letterSpacing: '-0.03em',
                                    color: '#fff',
                                    margin: 0,
                                    textShadow: '0 2px 24px rgba(0,0,0,0.4)',
                                }}
                            >
                                Island game modes,
                                <br />
                                snap-together simple.
                            </h1>
                            <p
                                style={{
                                    fontSize: 18,
                                    lineHeight: 1.55,
                                    color: 'rgba(255, 255, 255, 0.92)',
                                    marginTop: 22,
                                    maxWidth: 540,
                                    textShadow: '0 1px 8px rgba(0,0,0,0.4)',
                                }}
                            >
                                BentoBox powers island-style game modes for Paper servers. Pick the
                                modes you want, drop them in, and you&rsquo;re running. No forks, no
                                outdated code &mdash; one platform that stays current with every
                                Minecraft release.
                            </p>
                            <div
                                className="bb-flex-stack"
                                style={{
                                    display: 'flex',
                                    gap: 12,
                                    marginTop: 28,
                                    flexWrap: 'wrap',
                                }}
                            >
                                <a
                                    href="#presets-anchor"
                                    onClick={scrollToPresets}
                                    className="bb-btn bb-btn-accent"
                                    style={{ padding: '14px 22px', fontSize: 15 }}
                                >
                                    <FontAwesomeIcon icon={faCube} />
                                    Browse presets
                                </a>
                                <Link
                                    to="/custom"
                                    className="bb-btn bb-btn-paper"
                                    style={{ padding: '14px 22px', fontSize: 15 }}
                                >
                                    <FontAwesomeIcon icon={faWrench} />
                                    Build your own
                                </Link>
                            </div>
                            <div
                                className="bb-hide-sm"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 14,
                                    marginTop: 22,
                                    fontSize: 13,
                                    color: 'rgba(255, 255, 255, 0.85)',
                                    flexWrap: 'wrap',
                                }}
                            >
                                <span>Compatible with</span>
                                {['26.2', '26.1', '1.21', '1.20', '1.19', '1.18'].map((v) => (
                                    <span
                                        key={v}
                                        style={{
                                            fontFamily: 'var(--bb-mono)',
                                            padding: '2px 8px',
                                            borderRadius: 4,
                                            background: 'rgba(255, 255, 255, 0.15)',
                                            border: '1px solid rgba(255, 255, 255, 0.18)',
                                        }}
                                    >
                                        {v}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Right: quickstart card */}
                        <div className="bb-card bb-card-elev" style={{ padding: 24 }}>
                            <div className="bb-eyebrow" style={{ marginBottom: 8 }}>
                                Quickstart
                            </div>
                            <div
                                style={{
                                    fontFamily: 'var(--bb-display)',
                                    fontSize: 22,
                                    fontWeight: 600,
                                    marginBottom: 16,
                                    letterSpacing: '-0.01em',
                                }}
                            >
                                Running in 3 steps
                            </div>
                            <ol
                                style={{
                                    listStyle: 'none',
                                    padding: 0,
                                    margin: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 14,
                                }}
                            >
                                {[
                                    {
                                        t: 'Drop in your Paper plugins folder',
                                        s: 'BentoBox + the addons you picked, all in one ZIP.',
                                    },
                                    {
                                        t: 'Restart your server',
                                        s: 'Game modes auto-register and create their worlds.',
                                    },
                                    {
                                        t: 'Type /<gamemode>',
                                        s: 'e.g. /island to start your first island. That’s it.',
                                    },
                                ].map((s, i) => (
                                    <li
                                        key={i}
                                        style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}
                                    >
                                        <div
                                            style={{
                                                width: 26,
                                                height: 26,
                                                borderRadius: 6,
                                                background: 'var(--bb-ink)',
                                                color: 'var(--bb-paper)',
                                                display: 'grid',
                                                placeItems: 'center',
                                                fontFamily: 'var(--bb-mono)',
                                                fontSize: 12,
                                                fontWeight: 600,
                                                flexShrink: 0,
                                            }}
                                        >
                                            {i + 1}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 14 }}>
                                                {s.t}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    color: 'var(--bb-mute)',
                                                    marginTop: 2,
                                                }}
                                            >
                                                {s.s}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </div>
                </div>

                {/* Stat ticker */}
                <div
                    style={{
                        maxWidth: 1180,
                        margin: '0 auto',
                        padding: '0 28px 56px',
                    }}
                >
                    <div className="bb-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div
                            className="bb-grid-stats"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                background: 'rgba(245, 241, 232, 0.6)',
                            }}
                        >
                            <StatCell label="Servers running" value="1,300+" sub="and counting" />
                            <StatCell label="Game modes" value="11" sub="first-party" />
                            <StatCell label="Addons" value="20+" sub="mix and match" />
                            <StatCell
                                label="Versions"
                                value="MC 1.15–26.2.x"
                                sub="always current"
                                last
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* ── ON-PAPER: Why BentoBox + Sponsor ─────────────────── */}
            <section
                className="bb-section-pad"
                style={{ background: 'var(--bb-paper)', padding: '72px 28px' }}
            >
                <div style={{ maxWidth: 1180, margin: '0 auto' }}>
                    <div
                        className="bb-grid-2"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1.4fr 1fr',
                            gap: 32,
                        }}
                    >
                        <div>
                            <div className="bb-eyebrow">Why server admins choose BentoBox</div>
                            <h2
                                className="bb-display"
                                style={{
                                    fontSize: 36,
                                    margin: '4px 0 18px',
                                }}
                            >
                                Low-risk. Battle-tested. Open source.
                            </h2>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                <ReasonBullet>
                                    Run multiple game modes on one server with shared features
                                    &mdash; challenges, warps, levels, leaderboards.
                                </ReasonBullet>
                                <ReasonBullet>
                                    20+ addons let you customize exactly the experience you want.
                                </ReasonBullet>
                                <ReasonBullet>
                                    Actively maintained and always up to date with the latest
                                    Minecraft version.
                                </ReasonBullet>
                                <ReasonBullet>
                                    Free and open source &mdash; used on 1,300+ servers worldwide.
                                </ReasonBullet>
                                <ReasonBullet>
                                    Rich API for developers who want to build custom addons.
                                </ReasonBullet>
                            </ul>
                            <div
                                style={{
                                    marginTop: 28,
                                    display: 'flex',
                                    gap: 12,
                                    flexWrap: 'wrap',
                                }}
                            >
                                <Link
                                    to="/thirdparty"
                                    className="bb-btn bb-btn-ghost"
                                    style={{ fontSize: 14 }}
                                >
                                    <FontAwesomeIcon icon={faPuzzlePiece} />
                                    Third-party addons
                                </Link>
                                <Link
                                    to="/blueprints"
                                    className="bb-btn bb-btn-ghost"
                                    style={{ fontSize: 14 }}
                                >
                                    <FontAwesomeIcon icon={faLayerGroup} />
                                    Island blueprints
                                </Link>
                                <a
                                    href="https://docs.bentobox.world/"
                                    className="bb-btn bb-btn-ghost"
                                    style={{ fontSize: 14 }}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <FontAwesomeIcon icon={faArrowRight} />
                                    Documentation
                                </a>
                            </div>
                        </div>

                        <aside
                            className="bb-card"
                            style={{
                                padding: 24,
                                alignSelf: 'start',
                                position: 'relative',
                                overflow: 'hidden',
                            }}
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    top: -40,
                                    right: -40,
                                    width: 160,
                                    height: 160,
                                    borderRadius: '50%',
                                    background: 'var(--bb-green-soft)',
                                }}
                            />
                            <div style={{ position: 'relative' }}>
                                <FontAwesomeIcon
                                    icon={faHeart}
                                    style={{ color: 'var(--bb-rose)', fontSize: 22 }}
                                />
                                <h3
                                    className="bb-display"
                                    style={{
                                        fontSize: 22,
                                        margin: '14px 0 6px',
                                    }}
                                >
                                    Built by volunteers
                                </h3>
                                <p
                                    style={{
                                        fontSize: 14,
                                        lineHeight: 1.55,
                                        color: 'var(--bb-mute)',
                                        margin: 0,
                                    }}
                                >
                                    We&rsquo;re not a company &mdash; just a small team of programmers
                                    who love Minecraft. If BentoBox saves you time, please consider
                                    sponsoring tastybento.
                                </p>
                                <a
                                    href="https://github.com/sponsors/tastybento"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bb-btn bb-btn-primary"
                                    style={{ marginTop: 18, width: '100%' }}
                                >
                                    <FontAwesomeIcon icon={faHeart} />
                                    Sponsor on GitHub
                                </a>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: 'var(--bb-mute)',
                                        textAlign: 'center',
                                        marginTop: 10,
                                        fontFamily: 'var(--bb-mono)',
                                    }}
                                >
                                    github.com/sponsors/tastybento
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            </section>

            {/* ── Embedded presets ─────────────────────────────────── */}
            <section
                id="presets-anchor"
                className="bb-section-pad"
                style={{
                    background: 'var(--bb-paper-2)',
                    padding: '64px 28px',
                    borderTop: '1px solid var(--bb-line)',
                }}
            >
                <div style={{ maxWidth: 1180, margin: '0 auto' }}>
                    <div style={{ marginBottom: 32, textAlign: 'center' }}>
                        <div className="bb-eyebrow">Start here</div>
                        <h2
                            className="bb-display"
                            style={{
                                fontSize: 40,
                                margin: '8px 0 8px',
                            }}
                        >
                            Pick a preset
                        </h2>
                        <p
                            style={{
                                fontSize: 16,
                                color: 'var(--bb-mute)',
                                maxWidth: 600,
                                margin: '0 auto',
                                lineHeight: 1.55,
                            }}
                        >
                            Each preset bundles BentoBox plus a curated set of addons for one game
                            mode. Download the ZIP, drop it in <code>plugins/</code>, and restart.
                        </p>
                    </div>
                    <PresetsPage presets={presets} embedded />
                    <div style={{ textAlign: 'center', marginTop: 32 }}>
                        <Link to="/custom" className="bb-btn bb-btn-ghost">
                            <FontAwesomeIcon icon={faWrench} />
                            Or build your own custom mix
                            <FontAwesomeIcon icon={faArrowRight} />
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
