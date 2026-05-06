import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Route, Switch, useLocation } from 'react-router-dom';
import Navigation from './Navigation';
import Footer from './Footer';
import { GetAddons, GetBlueprints, GetPresets, GetThirdParty } from '../ApiRequestManager';
import { Async } from 'react-async';

const Landing = React.lazy(() => import('./Landing'));
const CustomPage = React.lazy(() => import('./CustomPage'));
const ThirdPartyPage = React.lazy(() => import('./ThirdParty'));
const BlueprintsPage = React.lazy(() => import('./Blueprints'));
const SubmitPage = React.lazy(() => import('./Submit'));
const TermsPage = React.lazy(() => import('./Terms'));
const PrivacyPage = React.lazy(() => import('./Privacy'));
const AccountPage = React.lazy(() => import('./Account'));
const AdminPage = React.lazy(() => import('./admin/AdminPage'));
const BlogList = React.lazy(() => import('./blog/BlogList'));
const BlogPost = React.lazy(() => import('./blog/BlogPost'));

/** Sets `body[data-route="..."]` so design-tokens.css can disable
 *  the legacy `md:bg-background` cover image on the landing page. */
function RouteAwareBody() {
    const location = useLocation();
    useEffect(() => {
        document.body.setAttribute('data-route', location.pathname);
    }, [location.pathname]);
    return null;
}

/** Paper-card wrapper used for every interior route (everything except `/`).
 *  Retains the original "soft surface" feel without the yellow tint. */
function InteriorWrap({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                maxWidth: 1180,
                margin: '32px auto',
                padding: '32px 24px',
                background: 'var(--bb-paper)',
                borderRadius: 'var(--r-lg)',
                boxShadow: 'var(--sh-1)',
                minHeight: '60vh',
            }}
        >
            {children}
        </div>
    );
}

// True when the SPA is running under blog.bentobox.world (or any "blog."
// subdomain). On that host the bare paths "/" and "/p/:slug" are the blog
// list and post permalink instead of the downloads landing page.
const onBlogHost =
    typeof window !== 'undefined' &&
    /^blog\./i.test(window.location.hostname);

export default function ContentBox() {
    function CustomElement() {
        const addonTypes = () => GetAddons();
        return (
            <Suspense fallback={<div />}>
                <Async promiseFn={addonTypes}>
                    {({ data, isLoading }) => {
                        if (isLoading) return <></>;
                        if (data) return <CustomPage addonTypes={data.filter((a) => a)} />;
                    }}
                </Async>
            </Suspense>
        );
    }

    function LandingElement() {
        const presets = () => GetPresets();
        return (
            <Suspense fallback={<div />}>
                <Async promiseFn={presets}>
                    {({ data, isLoading }) => {
                        if (isLoading) return <></>;
                        if (data) return <Landing presets={data.filter((a) => a)} />;
                    }}
                </Async>
            </Suspense>
        );
    }

    function ThirdPartyElement() {
        const data = () => GetThirdParty();
        return (
            <Suspense fallback={<div />}>
                <Async promiseFn={data}>
                    {({ data, isLoading }) => {
                        if (isLoading) return <></>;
                        if (data) return <ThirdPartyPage data={data} />;
                    }}
                </Async>
            </Suspense>
        );
    }

    function BlueprintsElement() {
        const data = () => GetBlueprints();
        return (
            <Suspense fallback={<div />}>
                <Async promiseFn={data}>
                    {({ data, isLoading }) => {
                        if (isLoading) return <></>;
                        if (data) return <BlueprintsPage data={data} />;
                    }}
                </Async>
            </Suspense>
        );
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Router>
                <RouteAwareBody />
                <Navigation />
                <main style={{ flex: 1 }}>
                    <Switch>
                        {/* On the blog subdomain, "/" and "/p/:slug" map to
                            the blog views; on download.* they fall through
                            to the routes below. */}
                        {onBlogHost && (
                            <Route exact path="/">
                                <Suspense fallback={<div />}>
                                    <BlogList />
                                </Suspense>
                            </Route>
                        )}
                        {onBlogHost && (
                            <Route path="/p/:slug">
                                <Suspense fallback={<div />}>
                                    <BlogPost />
                                </Suspense>
                            </Route>
                        )}

                        {/* Landing — full-bleed, no interior wrapper */}
                        <Route exact path="/">
                            <LandingElement />
                        </Route>

                        {/* /presets used to be a standalone page; the
                            presets section now lives inside Landing under
                            #presets-anchor. The Presets nav item links there. */}
                        {/* /custom and /thirdparty render their own dark hero
                            band edge-to-edge — they manage their own surfaces. */}
                        <Route path="/custom">
                            <CustomElement />
                        </Route>
                        <Route path="/thirdparty">
                            <ThirdPartyElement />
                        </Route>
                        {/* Blueprints renders its own navy sub-brand surface
                            edge-to-edge — skip the warm-paper InteriorWrap. */}
                        <Route path="/blueprints">
                            <BlueprintsElement />
                        </Route>
                        {/* /submit lives in the navy-paper sub-brand and
                            renders its own hero band edge-to-edge. */}
                        <Route path="/submit">
                            <Suspense fallback={<div />}>
                                <SubmitPage />
                            </Suspense>
                        </Route>
                        <Route path="/account">
                            <InteriorWrap>
                                <Suspense fallback={<div />}>
                                    <AccountPage />
                                </Suspense>
                            </InteriorWrap>
                        </Route>
                        <Route path="/admin">
                            <InteriorWrap>
                                <Suspense fallback={<div />}>
                                    <AdminPage />
                                </Suspense>
                            </InteriorWrap>
                        </Route>
                        {/* Blog: works on download.bentobox.world/blog/* and
                            on blog.bentobox.world/* (after the nginx host
                            rewrite that prepends /blog). Permalink pages are
                            also server-rendered with OG metadata in
                            src/index.ts. */}
                        <Route path="/blog/p/:slug">
                            <Suspense fallback={<div />}>
                                <BlogPost />
                            </Suspense>
                        </Route>
                        <Route path="/blog">
                            <Suspense fallback={<div />}>
                                <BlogList />
                            </Suspense>
                        </Route>
                        <Route path="/terms">
                            <InteriorWrap>
                                <Suspense fallback={<div />}>
                                    <TermsPage />
                                </Suspense>
                            </InteriorWrap>
                        </Route>
                        <Route path="/privacy">
                            <InteriorWrap>
                                <Suspense fallback={<div />}>
                                    <PrivacyPage />
                                </Suspense>
                            </InteriorWrap>
                        </Route>
                        <Route path="*">
                            <InteriorWrap>
                                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                                    <p
                                        className="bb-display"
                                        style={{ fontSize: 48, margin: 0 }}
                                    >
                                        404
                                    </p>
                                    <p style={{ fontSize: 18, color: 'var(--bb-mute)', marginTop: 8 }}>
                                        Page Not Found
                                    </p>
                                </div>
                            </InteriorWrap>
                        </Route>
                    </Switch>
                </main>
                <Footer />
            </Router>
        </div>
    );
}
