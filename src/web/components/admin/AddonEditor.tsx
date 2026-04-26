import React, { useState } from 'react';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrashAlt, faSave, faTimes } from '@fortawesome/free-solid-svg-icons';
import { AddonsEntity } from '../../../config';

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--bb-mute)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid var(--bb-line-strong)',
    borderRadius: 6,
    fontSize: 14,
    background: '#fff',
    color: 'var(--bb-ink)',
};
const monoStyle: React.CSSProperties = {
    ...inputStyle,
    fontFamily: 'var(--bb-mono)',
};

const MAX_DESCRIPTION_LEN = 4000;
const MC_VERSION_RE = /^[A-Za-z0-9._-]{1,32}$/;

interface VersionRow {
    mc: string;
    addon: string;
}

interface Props {
    initial: AddonsEntity;
    /** True when creating a new addon — name is editable. */
    creating: boolean;
    onSave: (addon: AddonsEntity) => Promise<void>;
    onCancel: () => void;
}

export default function AddonEditor({ initial, creating, onSave, onCancel }: Props) {
    const [draft, setDraft] = useState<AddonsEntity>(() => clone(initial));
    const [versionRows, setVersionRows] = useState<VersionRow[]>(() => versionsToRows(initial.versions));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [issues, setIssues] = useState<string[] | null>(null);

    function set<K extends keyof AddonsEntity>(key: K, value: AddonsEntity[K]) {
        setDraft({ ...draft, [key]: value });
    }

    function addVersionRow() {
        setVersionRows([...versionRows, { mc: '', addon: '' }]);
    }
    function updateVersionRow(idx: number, patch: Partial<VersionRow>) {
        setVersionRows(versionRows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    }
    function removeVersionRow(idx: number) {
        setVersionRows(versionRows.filter((_, i) => i !== idx));
    }

    async function handleSave() {
        setError(null);
        setIssues(null);
        const versions = rowsToVersions(versionRows);
        const localIssues: string[] = [];
        for (const r of versionRows) {
            if (r.mc && !MC_VERSION_RE.test(r.mc.trim())) {
                localIssues.push(
                    `Version key "${r.mc}" must be made of letters, digits, dots, dashes or underscores`,
                );
            }
            if (r.mc && !r.addon.trim()) {
                localIssues.push(`Version "${r.mc}" needs an addon version value`);
            }
        }
        if (localIssues.length) {
            setIssues(localIssues);
            return;
        }
        const next: AddonsEntity = {
            ...draft,
            ...(versions ? { versions } : {}),
        };
        if (!versions && next.versions) delete next.versions;
        setBusy(true);
        try {
            await onSave(next);
        } catch (err) {
            const e = err as {
                response?: { data?: { error?: string; issues?: string[]; presets?: string[] } };
                message?: string;
            };
            const data = e.response?.data;
            if (data?.issues) setIssues(data.issues);
            if (data?.error === 'name_taken') setError('An addon with that name already exists.');
            else if (data?.error === 'name_immutable') setError('Addon name cannot be changed.');
            else if (data?.error === 'protected_addon') setError('That addon is protected and cannot be modified this way.');
            else if (!data?.issues) setError(e.message ?? 'Save failed.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div css={tw`grid gap-4 mt-4 pt-4 border-t border-gray-200`}>
            <div css={tw`grid gap-4`} style={{ gridTemplateColumns: '2fr 1fr' }}>
                <div>
                    <label style={labelStyle}>Name</label>
                    <input
                        type="text"
                        value={draft.name}
                        readOnly={!creating}
                        disabled={!creating}
                        onChange={(e) => creating && set('name', e.target.value)}
                        style={creating ? inputStyle : { ...inputStyle, background: '#f3f4f6', color: '#6b7280' }}
                    />
                    {!creating && (
                        <p css={tw`text-xs text-gray-500 mt-1`}>
                            Names are immutable — they&rsquo;re referenced by presets.
                        </p>
                    )}
                </div>
                <div>
                    <label style={labelStyle}>Type</label>
                    <div css={tw`flex items-center gap-3 mt-2`}>
                        <label css={tw`inline-flex items-center gap-2 cursor-pointer`}>
                            <input
                                type="radio"
                                checked={!draft.gamemode}
                                onChange={() => set('gamemode', false)}
                            />
                            <span css={tw`text-sm`}>Addon</span>
                        </label>
                        <label css={tw`inline-flex items-center gap-2 cursor-pointer`}>
                            <input
                                type="radio"
                                checked={draft.gamemode}
                                onChange={() => set('gamemode', true)}
                            />
                            <span css={tw`text-sm`}>Game mode</span>
                        </label>
                    </div>
                </div>
            </div>

            <div css={tw`grid gap-4`} style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div>
                    <label style={labelStyle}>GitHub repo (owner/repo)</label>
                    <input
                        type="text"
                        value={draft.github}
                        onChange={(e) => set('github', e.target.value as AddonsEntity['github'])}
                        placeholder="BentoBoxWorld/AddonName"
                        style={monoStyle}
                    />
                </div>
                <div>
                    <label style={labelStyle}>Jenkins / CI path</label>
                    <input
                        type="text"
                        value={draft.ci}
                        onChange={(e) => set('ci', e.target.value)}
                        placeholder="BentoBoxWorld/AddonName"
                        style={monoStyle}
                    />
                </div>
            </div>

            <div>
                <label style={labelStyle}>Description (Markdown)</label>
                <textarea
                    value={draft.description}
                    onChange={(e) => set('description', e.target.value)}
                    rows={8}
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--bb-mono)', fontSize: 13 }}
                />
                <div css={tw`text-xs text-gray-500 text-right mt-1`}>
                    {draft.description.length} / {MAX_DESCRIPTION_LEN} chars
                </div>
            </div>

            <div>
                <label style={labelStyle}>
                    Per-Minecraft-version mappings{' '}
                    <span css={tw`text-gray-400 normal-case`}>
                        — older addon versions to keep available for older MC servers
                    </span>
                </label>
                <div
                    css={tw`border border-gray-200 rounded bg-gray-50 overflow-hidden`}
                >
                    {versionRows.length === 0 ? (
                        <div css={tw`p-3 text-sm text-gray-500`}>No legacy versions configured.</div>
                    ) : (
                        <table css={tw`w-full text-sm`}>
                            <thead>
                                <tr css={tw`text-xs text-gray-600 bg-gray-100`}>
                                    <th css={tw`text-left px-3 py-2 font-semibold`} style={{ width: '40%' }}>
                                        MC version
                                    </th>
                                    <th css={tw`text-left px-3 py-2 font-semibold`}>Addon version</th>
                                    <th css={tw`px-2 py-2`} style={{ width: 50 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {versionRows.map((r, i) => (
                                    <tr key={i} css={tw`border-t border-gray-200 bg-white`}>
                                        <td css={tw`px-3 py-2`}>
                                            <input
                                                type="text"
                                                value={r.mc}
                                                onChange={(e) => updateVersionRow(i, { mc: e.target.value })}
                                                placeholder="1.21.10"
                                                style={{ ...monoStyle, padding: '4px 8px' }}
                                            />
                                        </td>
                                        <td css={tw`px-3 py-2`}>
                                            <input
                                                type="text"
                                                value={r.addon}
                                                onChange={(e) => updateVersionRow(i, { addon: e.target.value })}
                                                placeholder="1.20.1"
                                                style={{ ...monoStyle, padding: '4px 8px' }}
                                            />
                                        </td>
                                        <td css={tw`px-2 py-2 text-center`}>
                                            <button
                                                type="button"
                                                onClick={() => removeVersionRow(i)}
                                                aria-label="Remove version"
                                                css={tw`text-red-700 hover:bg-red-50 rounded p-1`}
                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                                            >
                                                <FontAwesomeIcon icon={faTrashAlt} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <button
                    type="button"
                    onClick={addVersionRow}
                    css={tw`mt-2 text-sm text-gray-700 hover:text-gray-900 inline-flex items-center gap-2`}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                    <FontAwesomeIcon icon={faPlus} />
                    Add version row
                </button>
            </div>

            {issues && issues.length > 0 && (
                <div
                    css={tw`p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800`}
                >
                    <div css={tw`font-semibold mb-1`}>Validation issues:</div>
                    <ul css={tw`list-disc list-inside space-y-0.5`}>
                        {issues.map((s, i) => (
                            <li key={i}>{s}</li>
                        ))}
                    </ul>
                </div>
            )}
            {error && !issues && (
                <div css={tw`p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800`}>
                    {error}
                </div>
            )}

            <div css={tw`flex items-center gap-2 justify-end`}>
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={busy}
                    css={tw`px-3 py-2 rounded text-sm flex items-center gap-2`}
                    style={{
                        background: 'transparent',
                        border: '1px solid var(--bb-line-strong)',
                        cursor: busy ? 'not-allowed' : 'pointer',
                        opacity: busy ? 0.5 : 1,
                    }}
                >
                    <FontAwesomeIcon icon={faTimes} />
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={busy}
                    css={tw`px-3 py-2 rounded bg-gray-900 text-white text-sm flex items-center gap-2 disabled:opacity-50`}
                    style={{ border: 'none', cursor: busy ? 'not-allowed' : 'pointer' }}
                >
                    <FontAwesomeIcon icon={faSave} />
                    {busy ? 'Saving…' : creating ? 'Create addon' : 'Save changes'}
                </button>
            </div>
        </div>
    );
}

function clone<T>(v: T): T {
    return JSON.parse(JSON.stringify(v));
}

function versionsToRows(v: Record<string, string> | undefined): VersionRow[] {
    if (!v) return [];
    return Object.entries(v)
        .map(([mc, addon]) => ({ mc, addon }))
        .sort((a, b) => compareMcVersion(b.mc, a.mc));
}

function rowsToVersions(rows: VersionRow[]): Record<string, string> | undefined {
    const out: Record<string, string> = {};
    for (const r of rows) {
        const mc = r.mc.trim();
        const addon = r.addon.trim();
        if (mc && addon) out[mc] = addon;
    }
    return Object.keys(out).length ? out : undefined;
}

function compareMcVersion(a: string, b: string): number {
    const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
    const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const da = pa[i] ?? 0;
        const db = pb[i] ?? 0;
        if (da !== db) return da - db;
    }
    return 0;
}
