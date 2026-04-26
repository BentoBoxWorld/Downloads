import React, { useEffect, useState } from 'react';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCodeBranch,
    faExclamationCircle,
    faExternalLinkAlt,
    faHistory,
    faRedo,
    faUndo,
} from '@fortawesome/free-solid-svg-icons';
import {
    AdminAudit,
    AdminOverride,
    AdminScope,
    DeleteAdminOverride,
    GetAdminAudits,
    GetAdminOverrides,
    PostAdminPr,
    SessionUser,
} from '../../ApiRequestManager';

export default function RecentTab({ user }: { user: SessionUser }) {
    const [overrides, setOverrides] = useState<AdminOverride[] | null>(null);
    const [audits, setAudits] = useState<AdminAudit[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busyScope, setBusyScope] = useState<AdminScope | null>(null);
    const [prBusy, setPrBusy] = useState(false);
    const [prError, setPrError] = useState<string | null>(null);
    const [prUrl, setPrUrl] = useState<string | null>(null);

    function load() {
        setLoadError(null);
        Promise.all([GetAdminOverrides(), GetAdminAudits()])
            .then(([o, a]) => {
                setOverrides(o);
                setAudits(a);
            })
            .catch((err) => setLoadError(err.message ?? 'Failed to load.'));
    }

    useEffect(load, []);

    async function handleReset(scope: AdminScope) {
        if (!confirm(`Reset ${scope} to the baseline from config.json? Your current ${scope} override will be removed.`)) {
            return;
        }
        setBusyScope(scope);
        try {
            await DeleteAdminOverride(user.csrfToken, scope);
            load();
        } catch (err) {
            alert('Reset failed: ' + (err as Error).message);
        } finally {
            setBusyScope(null);
        }
    }

    async function handleOpenPr() {
        setPrBusy(true);
        setPrError(null);
        setPrUrl(null);
        try {
            const r = await PostAdminPr(user.csrfToken);
            setPrUrl(r.prUrl);
        } catch (err) {
            const e = err as { response?: { data?: { error?: string; detail?: string } } };
            const code = e.response?.data?.error;
            if (code === 'pr_not_configured')
                setPrError(
                    'Export-PR is not configured on this server. Set the admin_github block in env.json to enable it.',
                );
            else if (code === 'no_overrides')
                setPrError('Nothing to sync — there are no active overrides.');
            else if (code === 'no_diff')
                setPrError('No diff against config.json — your overrides already match the file.');
            else if (code === 'github_error')
                setPrError(`GitHub error: ${e.response?.data?.detail ?? 'unknown'}`);
            else setPrError((err as Error).message ?? 'PR failed.');
        } finally {
            setPrBusy(false);
        }
    }

    if (loadError) return <ErrorBanner text={loadError} />;
    if (!overrides || !audits) return <div css={tw`text-sm text-gray-500`}>Loading…</div>;

    const hasOverrides = overrides.length > 0;

    return (
        <div>
            <h3 css={tw`text-lg font-semibold mb-1`}>Recent changes</h3>
            <p css={tw`text-sm text-gray-600 mb-4`}>
                State of admin overrides versus the baseline <code>config.json</code> in git, plus
                the most recent audit-log entries.
            </p>

            {/* --- Active overrides --- */}
            <section css={tw`mb-6`}>
                <h4 css={tw`text-sm font-semibold uppercase text-gray-600 tracking-wide mb-2`}>
                    Active overrides
                </h4>
                {!hasOverrides && (
                    <div
                        css={tw`p-3 rounded bg-gray-50 border border-gray-200 text-sm text-gray-600`}
                    >
                        No overrides active. The site is serving exactly what&rsquo;s in{' '}
                        <code>config.json</code>.
                    </div>
                )}
                {hasOverrides && (
                    <div css={tw`space-y-2`}>
                        {overrides.map((o) => (
                            <div
                                key={o.scope}
                                css={tw`flex items-center gap-3 p-3 bg-white rounded border border-gray-200`}
                            >
                                <span
                                    css={tw`text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 uppercase tracking-wide`}
                                >
                                    {o.scope}
                                </span>
                                <span css={tw`text-sm text-gray-700`}>
                                    last edited by{' '}
                                    <strong>{o.updatedByName || o.updatedBy || 'unknown'}</strong>{' '}
                                    {relativeTime(o.updatedAt)}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleReset(o.scope)}
                                    disabled={busyScope === o.scope}
                                    css={tw`ml-auto px-3 py-1 rounded text-sm flex items-center gap-2 disabled:opacity-50`}
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid var(--bb-line-strong)',
                                        cursor: busyScope === o.scope ? 'not-allowed' : 'pointer',
                                    }}
                                    title="Drop this override and revert to config.json"
                                >
                                    <FontAwesomeIcon icon={faUndo} />
                                    Reset to baseline
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* --- Sync to git --- */}
            <section css={tw`mb-6`}>
                <h4 css={tw`text-sm font-semibold uppercase text-gray-600 tracking-wide mb-2`}>
                    Sync to git
                </h4>
                <div css={tw`p-4 bg-blue-50 border border-blue-200 rounded`}>
                    <div css={tw`flex items-start gap-3`}>
                        <FontAwesomeIcon
                            icon={faCodeBranch}
                            style={{ marginTop: 4, color: '#1d4ed8' }}
                        />
                        <div css={tw`flex-1`}>
                            <div css={tw`font-medium text-blue-900`}>Open a PR with current overrides</div>
                            <p css={tw`text-sm text-blue-800 m-0 mt-1`}>
                                Generates a pull request on the Downloads repository updating{' '}
                                <code>config.json</code> to match the live, override-merged state.
                                Use this so the SCM-tracked baseline stays in sync — useful for new
                                deployments, recovery, or just plain history.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleOpenPr}
                            disabled={prBusy || !hasOverrides}
                            css={tw`px-3 py-2 rounded bg-blue-700 text-white text-sm hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0`}
                            style={{ border: 'none' }}
                            title={
                                hasOverrides
                                    ? 'Open a PR with current overrides'
                                    : 'Nothing to sync — no overrides active'
                            }
                        >
                            <FontAwesomeIcon icon={prBusy ? faRedo : faCodeBranch} spin={prBusy} />
                            {prBusy ? 'Opening…' : 'Open PR'}
                        </button>
                    </div>
                    {prUrl && (
                        <div css={tw`mt-3 p-2 bg-white rounded border border-blue-200 text-sm flex items-center gap-2`}>
                            <span>PR opened:</span>
                            <a
                                href={prUrl}
                                target="_blank"
                                rel="noreferrer"
                                css={tw`text-blue-700 underline flex items-center gap-1`}
                            >
                                {prUrl}
                                <FontAwesomeIcon icon={faExternalLinkAlt} style={{ fontSize: 10 }} />
                            </a>
                        </div>
                    )}
                    {prError && (
                        <div css={tw`mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800 flex items-start gap-2`}>
                            <FontAwesomeIcon icon={faExclamationCircle} style={{ marginTop: 2 }} />
                            <span>{prError}</span>
                        </div>
                    )}
                </div>
            </section>

            {/* --- Audit log --- */}
            <section>
                <h4 css={tw`text-sm font-semibold uppercase text-gray-600 tracking-wide mb-2 flex items-center gap-2`}>
                    <FontAwesomeIcon icon={faHistory} />
                    Activity log
                </h4>
                {audits.length === 0 ? (
                    <div
                        css={tw`p-3 rounded bg-gray-50 border border-gray-200 text-sm text-gray-500`}
                    >
                        No admin actions recorded yet.
                    </div>
                ) : (
                    <ol css={tw`space-y-1 m-0 p-0 list-none`}>
                        {audits.map((a) => (
                            <li
                                key={a.id}
                                css={tw`flex items-baseline gap-2 text-sm py-1 border-b border-gray-100 last:border-0`}
                            >
                                <span
                                    css={tw`text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 uppercase tracking-wide flex-shrink-0`}
                                    style={{ minWidth: 60, textAlign: 'center' }}
                                >
                                    {a.scope}
                                </span>
                                <span css={tw`flex-1 text-gray-800 truncate`} title={a.summary}>
                                    {a.summary}
                                </span>
                                <span css={tw`text-xs text-gray-500 flex-shrink-0`}>
                                    {a.username || a.userId || 'system'}
                                </span>
                                <span
                                    css={tw`text-xs text-gray-500 flex-shrink-0`}
                                    title={new Date(a.at).toLocaleString()}
                                >
                                    {relativeTime(a.at)}
                                </span>
                            </li>
                        ))}
                    </ol>
                )}
            </section>
        </div>
    );
}

function ErrorBanner({ text }: { text: string }) {
    return (
        <div css={tw`p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800`}>{text}</div>
    );
}

function relativeTime(ms: number): string {
    const diff = Date.now() - ms;
    if (diff < 0) return 'in the future';
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(ms).toLocaleDateString();
}
