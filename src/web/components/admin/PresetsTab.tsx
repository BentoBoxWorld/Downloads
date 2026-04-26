import React, { useEffect, useState } from 'react';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowUp,
    faArrowDown,
    faTrashAlt,
    faPlus,
    faSave,
    faUndo,
    faChevronDown,
    faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { AddonType, PresetsEntity } from '../../../config';
import {
    GetAddons,
    GetAdminPresets,
    PutAdminPresets,
    SessionUser,
} from '../../ApiRequestManager';
import PresetEditor from './PresetEditor';

export default function PresetsTab({ user }: { user: SessionUser }) {
    const [server, setServer] = useState<PresetsEntity[] | null>(null);
    const [draft, setDraft] = useState<PresetsEntity[] | null>(null);
    const [addons, setAddons] = useState<AddonType[]>([]);
    const [expanded, setExpanded] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [issues, setIssues] = useState<string[] | null>(null);
    const [busy, setBusy] = useState(false);

    function load() {
        setError(null);
        setIssues(null);
        Promise.all([GetAdminPresets(), GetAddons()])
            .then(([presets, allAddons]) => {
                setServer(presets);
                setDraft(presets.map(clonePreset));
                setAddons(allAddons);
            })
            .catch((err) => setError(err.message ?? 'Failed to load presets.'));
    }

    useEffect(load, []);

    if (!draft || !server) {
        return error ? (
            <ErrorBanner text={error} />
        ) : (
            <div css={tw`text-sm text-gray-500`}>Loading…</div>
        );
    }

    const dirty = JSON.stringify(server) !== JSON.stringify(draft);

    function update(idx: number, next: PresetsEntity) {
        setDraft(draft!.map((p, i) => (i === idx ? next : p)));
    }
    function move(idx: number, delta: -1 | 1) {
        const target = idx + delta;
        if (target < 0 || target >= draft!.length) return;
        const next = [...draft!];
        [next[idx], next[target]] = [next[target], next[idx]];
        setDraft(next);
        if (expanded === idx) setExpanded(target);
        else if (expanded === target) setExpanded(idx);
    }
    function remove(idx: number) {
        setDraft(draft!.filter((_, i) => i !== idx));
        if (expanded === idx) setExpanded(null);
        else if (expanded !== null && expanded > idx) setExpanded(expanded - 1);
    }
    function add() {
        const next: PresetsEntity = {
            name: 'New Preset',
            description: '',
            subtext: '',
            addons: [],
            color: '#888888',
        };
        setDraft([...draft!, next]);
        setExpanded(draft!.length);
    }
    function discard() {
        setDraft(server!.map(clonePreset));
        setExpanded(null);
        setError(null);
        setIssues(null);
    }
    async function save() {
        setError(null);
        setIssues(null);
        setBusy(true);
        try {
            await PutAdminPresets(user.csrfToken, draft!);
            load();
        } catch (err) {
            const e = err as {
                response?: { data?: { error?: string; issues?: string[] } };
                message?: string;
            };
            const data = e.response?.data;
            if (data?.issues) setIssues(data.issues);
            setError(extractError(err) ?? 'Failed to save presets.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div>
            <div css={tw`flex items-baseline justify-between mb-4 gap-3`}>
                <div>
                    <h3 css={tw`text-lg font-semibold m-0`}>Presets</h3>
                    <p css={tw`text-sm text-gray-600 m-0 mt-1`}>
                        Reorder and edit the presets shown on the home page. Changes take effect
                        immediately when you save.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={add}
                    css={tw`px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm flex items-center gap-2 flex-shrink-0`}
                    style={{ border: '1px solid var(--bb-line-strong)', cursor: 'pointer' }}
                >
                    <FontAwesomeIcon icon={faPlus} />
                    Add preset
                </button>
            </div>

            <div css={tw`space-y-2 mb-6`}>
                {draft.map((p, i) => (
                    <div
                        key={i}
                        css={tw`bg-white rounded border border-gray-200`}
                        style={{ borderLeft: `5px solid ${p.color || '#888'}` }}
                    >
                        <div css={tw`flex items-center gap-2 p-3`}>
                            <button
                                type="button"
                                onClick={() => setExpanded(expanded === i ? null : i)}
                                css={tw`flex items-center gap-2 flex-1 min-w-0 text-left`}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                            >
                                <FontAwesomeIcon
                                    icon={expanded === i ? faChevronDown : faChevronRight}
                                    style={{ width: 12, color: 'var(--bb-mute)' }}
                                />
                                <span css={tw`font-medium truncate`}>{p.name || '(unnamed)'}</span>
                                <span css={tw`text-xs text-gray-500 truncate`}>
                                    {p.addons.length} addon{p.addons.length === 1 ? '' : 's'}
                                </span>
                            </button>
                            <div css={tw`flex items-center gap-1 flex-shrink-0`}>
                                <IconButton
                                    icon={faArrowUp}
                                    label="Move up"
                                    onClick={() => move(i, -1)}
                                    disabled={i === 0}
                                />
                                <IconButton
                                    icon={faArrowDown}
                                    label="Move down"
                                    onClick={() => move(i, 1)}
                                    disabled={i === draft.length - 1}
                                />
                                <IconButton
                                    icon={faTrashAlt}
                                    label="Delete"
                                    onClick={() => {
                                        if (
                                            confirm(`Delete preset "${p.name}"? You'll still need to click Save.`)
                                        ) {
                                            remove(i);
                                        }
                                    }}
                                    danger
                                />
                            </div>
                        </div>
                        {expanded === i && (
                            <div css={tw`px-3 pb-3`}>
                                <PresetEditor
                                    preset={p}
                                    addons={addons}
                                    onChange={(next) => update(i, next)}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {issues && issues.length > 0 && (
                <div
                    css={tw`mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800`}
                >
                    <div css={tw`font-semibold mb-1`}>Validation issues:</div>
                    <ul css={tw`list-disc list-inside space-y-0.5`}>
                        {issues.map((s, i) => (
                            <li key={i}>{s}</li>
                        ))}
                    </ul>
                </div>
            )}
            {error && !issues && <ErrorBanner text={error} />}

            <div
                css={tw`flex items-center gap-2 sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-white border-t border-gray-200`}
            >
                <span css={tw`text-sm text-gray-600 mr-auto`}>
                    {dirty ? 'Unsaved changes' : 'No changes'}
                </span>
                <button
                    type="button"
                    onClick={discard}
                    disabled={!dirty || busy}
                    css={tw`px-3 py-2 rounded text-sm flex items-center gap-2`}
                    style={{
                        background: 'transparent',
                        border: '1px solid var(--bb-line-strong)',
                        cursor: dirty && !busy ? 'pointer' : 'not-allowed',
                        opacity: dirty && !busy ? 1 : 0.5,
                    }}
                >
                    <FontAwesomeIcon icon={faUndo} />
                    Discard
                </button>
                <button
                    type="button"
                    onClick={save}
                    disabled={!dirty || busy}
                    css={tw`px-3 py-2 rounded bg-gray-900 text-white text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                    style={{ border: 'none', cursor: dirty && !busy ? 'pointer' : 'not-allowed' }}
                >
                    <FontAwesomeIcon icon={faSave} />
                    {busy ? 'Saving…' : 'Save changes'}
                </button>
            </div>
        </div>
    );
}

function IconButton({
    icon,
    label,
    onClick,
    disabled,
    danger,
}: {
    icon: import('@fortawesome/fontawesome-svg-core').IconDefinition;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            title={label}
            css={[
                tw`w-8 h-8 rounded flex items-center justify-center text-sm`,
                disabled
                    ? tw`text-gray-300 cursor-not-allowed`
                    : danger
                    ? tw`text-red-700 hover:bg-red-50`
                    : tw`text-gray-600 hover:bg-gray-100`,
            ]}
            style={{ background: 'transparent', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
            <FontAwesomeIcon icon={icon} />
        </button>
    );
}

function ErrorBanner({ text }: { text: string }) {
    return (
        <div css={tw`mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800`}>
            {text}
        </div>
    );
}

function clonePreset(p: PresetsEntity): PresetsEntity {
    return JSON.parse(JSON.stringify(p));
}

function extractError(err: unknown): string | null {
    const e = err as { response?: { data?: { error?: string } }; message?: string };
    const code = e.response?.data?.error;
    if (code === 'invalid_presets') return 'Some presets failed validation. See the list above.';
    if (code === 'forbidden') return 'You are not authorized to manage presets.';
    return e.message ?? null;
}
