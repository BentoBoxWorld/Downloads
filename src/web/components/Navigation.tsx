import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCube,
    faWrench,
    faPuzzlePiece,
    faLayerGroup,
    faHome,
    faBars,
    faTimes,
    faShieldAlt,
    faCaretDown,
    faSignOutAlt,
    faUser,
    faNewspaper,
} from '@fortawesome/free-solid-svg-icons';
import { faDiscord, faGithub } from '@fortawesome/free-brands-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { GetMe, PostLogout, SessionUser } from '../ApiRequestManager';

interface Tab {
    to: string;
    label: string;
    icon: IconDefinition;
    exact?: boolean;
    /** When set, the entry renders as a hash anchor on the landing page,
     *  not a router link — Presets lives inside Landing. */
    landingAnchor?: string;
}

const NAV_OFFSET_PX = 60;

function smoothScrollToAnchor(anchorId: string) {
    const el = document.getElementById(anchorId);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET_PX;
    window.scrollTo({ top, behavior: 'smooth' });
}

/** When already on `/`, prevent the navigation and just scroll. Otherwise let
 *  the browser navigate to `/#anchor` and Landing's mount-effect handles it. */
function handleAnchorClick(
    e: React.MouseEvent<HTMLAnchorElement>,
    anchorId: string,
    pathname: string,
) {
    if (pathname === '/') {
        e.preventDefault();
        smoothScrollToAnchor(anchorId);
    }
}

const BASE_TABS: Tab[] = [
    { to: '/', label: 'Home', icon: faHome, exact: true },
    { to: '/', label: 'Presets', icon: faCube, landingAnchor: 'presets-anchor' },
    { to: '/custom', label: 'Custom', icon: faWrench },
    { to: '/thirdparty', label: 'Third-Party', icon: faPuzzlePiece },
    { to: '/blueprints', label: 'Blueprints', icon: faLayerGroup },
    { to: '/blog', label: 'Blog', icon: faNewspaper },
];

const ADMIN_TAB: Tab = { to: '/admin', label: 'Admin', icon: faShieldAlt };

export default function Navigation() {
    const location = useLocation();
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        let cancelled = false;
        GetMe()
            .then((u) => {
                if (!cancelled) setUser(u);
            })
            .catch(() => {
                if (!cancelled) setUser(null);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!menuOpen) return;
        const onDocClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [menuOpen]);

    async function handleLogout() {
        if (!user) return;
        try {
            await PostLogout(user.csrfToken);
        } finally {
            // Hard reload so every component (admin link, account page, etc.)
            // re-fetches /api/me and re-renders without a session.
            window.location.href = '/';
        }
    }

    const isAdmin = !!user && user.isAdmin;
    const canAuthorBlog = !!user && user.canAuthorBlog;
    const showAdminTab = isAdmin || canAuthorBlog;
    const TABS: Tab[] = showAdminTab ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;

    // The header sits on top of the dark hero on `/` and stays transparent
    // until the user scrolls past it. On every other route it's solid paper.
    const isLanding = location.pathname === '/';

    useEffect(() => {
        if (!isLanding) {
            setScrolled(true);
            return;
        }
        setScrolled(false);
        const onScroll = () => setScrolled(window.scrollY > 80);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [isLanding]);

    useEffect(() => {
        // Close mobile drawer on route change
        setMobileOpen(false);
    }, [location.pathname]);

    const transparent = isLanding && !scrolled && !mobileOpen;

    const headerStyle: React.CSSProperties = {
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: transparent ? 'transparent' : 'rgba(245, 241, 232, 0.92)',
        backdropFilter: transparent ? 'none' : 'blur(10px)',
        WebkitBackdropFilter: transparent ? 'none' : 'blur(10px)',
        borderBottom: transparent ? '1px solid transparent' : '1px solid var(--bb-line)',
        transition: 'background 0.2s ease, border-color 0.2s ease',
        color: transparent ? '#fff' : 'var(--bb-ink)',
    };

    return (
        <header style={headerStyle}>
            <div
                style={{
                    maxWidth: 1180,
                    margin: '0 auto',
                    padding: '14px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 24,
                }}
            >
                {/* Logo */}
                <NavLink
                    to="/"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        textDecoration: 'none',
                        color: 'inherit',
                        flexShrink: 0,
                    }}
                >
                    <div
                        style={{
                            width: 30,
                            height: 30,
                            borderRadius: 7,
                            background: transparent ? 'rgba(255,255,255,0.95)' : 'var(--bb-ink)',
                            color: transparent ? 'var(--bb-ink)' : 'var(--bb-paper)',
                            display: 'grid',
                            placeItems: 'center',
                            fontFamily: 'var(--bb-display)',
                            fontWeight: 700,
                            fontSize: 15,
                            transition: 'background 0.2s, color 0.2s',
                        }}
                    >
                        B
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
                        <span
                            style={{
                                fontFamily: 'var(--bb-display)',
                                fontWeight: 700,
                                fontSize: 16,
                                letterSpacing: '-0.01em',
                            }}
                        >
                            BentoBox
                        </span>
                        <span
                            style={{
                                fontSize: 10,
                                color: transparent ? 'rgba(255,255,255,0.7)' : 'var(--bb-mute)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.12em',
                            }}
                        >
                            Downloads
                        </span>
                    </div>
                </NavLink>

                {/* Desktop tabs */}
                <nav
                    className="bb-hide-sm"
                    style={{ display: 'flex', gap: 2, marginLeft: 12, flex: 1 }}
                >
                    {TABS.map((t) => {
                        const linkStyle: React.CSSProperties = {
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 12px',
                            borderRadius: 8,
                            fontWeight: 500,
                            fontSize: 14,
                            textDecoration: 'none',
                            color: 'inherit',
                            transition: 'background 0.15s',
                            cursor: 'pointer',
                            background: 'transparent',
                            border: 'none',
                        };
                        if (t.landingAnchor) {
                            return (
                                <a
                                    key={t.label}
                                    href={`/#${t.landingAnchor}`}
                                    onClick={(e) =>
                                        handleAnchorClick(e, t.landingAnchor!, location.pathname)
                                    }
                                    style={linkStyle}
                                >
                                    <FontAwesomeIcon icon={t.icon} />
                                    {t.label}
                                </a>
                            );
                        }
                        return (
                            <NavLink
                                key={t.label}
                                to={t.to}
                                exact={t.exact}
                                style={linkStyle}
                                activeStyle={{
                                    background: transparent
                                        ? 'rgba(255,255,255,0.18)'
                                        : 'var(--bb-ink)',
                                    color: transparent ? '#fff' : 'var(--bb-paper)',
                                }}
                            >
                                <FontAwesomeIcon icon={t.icon} />
                                {t.label}
                            </NavLink>
                        );
                    })}
                </nav>

                {/* Right cluster (desktop) */}
                <div
                    className="bb-hide-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}
                >
                    <a
                        href="https://github.com/BentoBoxWorld"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bb-btn bb-btn-ghost"
                        style={{
                            padding: '8px 12px',
                            fontSize: 13,
                            color: 'inherit',
                            borderColor: transparent
                                ? 'rgba(255,255,255,0.3)'
                                : 'var(--bb-line-strong)',
                        }}
                    >
                        <FontAwesomeIcon icon={faGithub} />
                        <span>GitHub</span>
                    </a>
                    <a
                        href="https://discord.gg/KwjFBUaNSt"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bb-btn bb-btn-discord"
                        style={{ padding: '8px 12px', fontSize: 13 }}
                    >
                        <FontAwesomeIcon icon={faDiscord} />
                        Discord
                    </a>
                    {user && (
                        <div ref={menuRef} style={{ position: 'relative' }}>
                            <button
                                type="button"
                                onClick={() => setMenuOpen((o) => !o)}
                                aria-haspopup="menu"
                                aria-expanded={menuOpen}
                                className="bb-btn bb-btn-discord"
                                style={{
                                    padding: '6px 10px',
                                    fontSize: 13,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                            >
                                {user.avatarUrl ? (
                                    <img
                                        src={user.avatarUrl}
                                        alt=""
                                        style={{ width: 22, height: 22, borderRadius: '50%' }}
                                    />
                                ) : (
                                    <FontAwesomeIcon icon={faUser} />
                                )}
                                <span>{user.globalName || user.username}</span>
                                <FontAwesomeIcon icon={faCaretDown} />
                            </button>
                            {menuOpen && (
                                <div
                                    role="menu"
                                    style={{
                                        position: 'absolute',
                                        top: 'calc(100% + 6px)',
                                        right: 0,
                                        minWidth: 180,
                                        background: 'var(--bb-paper)',
                                        border: '1px solid var(--bb-line)',
                                        borderRadius: 8,
                                        boxShadow: 'var(--sh-1)',
                                        padding: 4,
                                        zIndex: 100,
                                        color: 'var(--bb-ink)',
                                    }}
                                >
                                    <NavLink
                                        to="/account"
                                        onClick={() => setMenuOpen(false)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: '8px 10px',
                                            borderRadius: 6,
                                            textDecoration: 'none',
                                            color: 'inherit',
                                            fontSize: 14,
                                        }}
                                    >
                                        <FontAwesomeIcon icon={faUser} style={{ width: 14 }} />
                                        Account
                                    </NavLink>
                                    {showAdminTab && (
                                        <NavLink
                                            to="/admin"
                                            onClick={() => setMenuOpen(false)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 10,
                                                padding: '8px 10px',
                                                borderRadius: 6,
                                                textDecoration: 'none',
                                                color: 'inherit',
                                                fontSize: 14,
                                            }}
                                        >
                                            <FontAwesomeIcon icon={faShieldAlt} style={{ width: 14 }} />
                                            Admin
                                        </NavLink>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMenuOpen(false);
                                            handleLogout();
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            width: '100%',
                                            padding: '8px 10px',
                                            borderRadius: 6,
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'inherit',
                                            fontSize: 14,
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <FontAwesomeIcon icon={faSignOutAlt} style={{ width: 14 }} />
                                        Log out
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Mobile hamburger */}
                <button
                    aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                    aria-expanded={mobileOpen}
                    onClick={() => setMobileOpen((v) => !v)}
                    className="bb-mobile-only"
                    style={{
                        marginLeft: 'auto',
                        background: 'transparent',
                        border: 'none',
                        color: 'inherit',
                        padding: 8,
                        fontSize: 20,
                        cursor: 'pointer',
                        display: 'none',
                    }}
                >
                    <FontAwesomeIcon icon={mobileOpen ? faTimes : faBars} />
                </button>
            </div>

            {/* Mobile drawer */}
            {mobileOpen && (
                <div
                    style={{
                        background: 'var(--bb-paper)',
                        borderTop: '1px solid var(--bb-line)',
                        padding: '12px 24px 20px',
                    }}
                >
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {TABS.map((t) => {
                            const itemStyle: React.CSSProperties = {
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: '12px 14px',
                                borderRadius: 8,
                                fontWeight: 500,
                                fontSize: 15,
                                textDecoration: 'none',
                                color: 'var(--bb-ink)',
                            };
                            if (t.landingAnchor) {
                                return (
                                    <a
                                        key={t.label}
                                        href={`/#${t.landingAnchor}`}
                                        onClick={(e) =>
                                            handleAnchorClick(
                                                e,
                                                t.landingAnchor!,
                                                location.pathname,
                                            )
                                        }
                                        style={itemStyle}
                                    >
                                        <FontAwesomeIcon
                                            icon={t.icon}
                                            style={{ width: 18 }}
                                        />
                                        {t.label}
                                    </a>
                                );
                            }
                            return (
                                <NavLink
                                    key={t.label}
                                    to={t.to}
                                    exact={t.exact}
                                    style={itemStyle}
                                    activeStyle={{
                                        background: 'var(--bb-ink)',
                                        color: 'var(--bb-paper)',
                                    }}
                                >
                                    <FontAwesomeIcon icon={t.icon} style={{ width: 18 }} />
                                    {t.label}
                                </NavLink>
                            );
                        })}
                    </nav>
                    <div
                        style={{
                            display: 'flex',
                            gap: 10,
                            marginTop: 16,
                            paddingTop: 16,
                            borderTop: '1px solid var(--bb-line)',
                        }}
                    >
                        <a
                            href="https://github.com/BentoBoxWorld"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bb-btn bb-btn-ghost"
                            style={{ flex: 1, fontSize: 13 }}
                        >
                            <FontAwesomeIcon icon={faGithub} />
                            GitHub
                        </a>
                        <a
                            href="https://discord.gg/KwjFBUaNSt"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bb-btn bb-btn-discord"
                            style={{ flex: 1, fontSize: 13 }}
                        >
                            <FontAwesomeIcon icon={faDiscord} />
                            Discord
                        </a>
                    </div>
                    {user && (
                        <div
                            style={{
                                marginTop: 16,
                                paddingTop: 16,
                                borderTop: '1px solid var(--bb-line)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                            }}
                        >
                            {user.avatarUrl ? (
                                <img
                                    src={user.avatarUrl}
                                    alt=""
                                    style={{ width: 28, height: 28, borderRadius: '50%' }}
                                />
                            ) : (
                                <FontAwesomeIcon icon={faUser} />
                            )}
                            <span style={{ fontSize: 14, color: 'var(--bb-ink)' }}>
                                {user.globalName || user.username}
                            </span>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="bb-btn bb-btn-discord"
                                style={{
                                    marginLeft: 'auto',
                                    padding: '6px 10px',
                                    fontSize: 13,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    border: 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                <FontAwesomeIcon icon={faSignOutAlt} />
                                Log out
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Mobile-only display rule for hamburger (scoped via element) */}
            <style>{`
                @media (max-width: 768px) {
                    .bb-mobile-only { display: inline-flex !important; }
                }
            `}</style>
        </header>
    );
}
