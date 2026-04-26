import React, { useEffect, useState } from 'react';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChevronDown,
    faChevronRight,
    faExternalLinkAlt,
    faPlus,
    faTrashAlt,
} from '@fortawesome/free-solid-svg-icons';
import { AddonsEntity } from '../../../config';
import {
    DeleteAdminAddon,
    GetAdminAddons,
    PostAdminAddon,
    PutAdminAddon,
    SessionUser,
} from '../../ApiRequestManager';
import AddonEditor from './AddonEditor';

const PROTECTED = new Set(['BentoBox']);

export default function AddonsTab({ user }: { user: SessionUser }) {
    const [addons, setAddons] = useState<AddonsEntity[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    function load() {
        setError(null);
        GetAdminAddons()
            .then(setAddons)
            .catch((err) => setError(err.message ?? 'Failed to load addons.'));
    }

    useEffect(load, []);

    if (!addons && !error) {
        return <div css={tw`text-sm text-gray-500`}>Loading…</div>;
    }
    if (error && !addons) {
        return (
            <div css={tw`p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800`}>
                {error}
            </div>
        );
    }

    async function handleCreate(addon: AddonsEntity) {
        await PostAdminAddon(user.csrfToken, addon);
        setCreating(false);
        load();
    }
    async function handleUpdate(name: string, addon: AddonsEntity) {
        await PutAdminAddon(user.csrfToken, name, addon);
        setExpanded(null);
        load();
    }
    async function handleDelete(name: string) {
        try {
            await DeleteAdminAddon(user.csrfToken, name);
            load();
        } catch (err) {
            const e = err as {
                response?: { data?: { error?: string; presets?: string[] } };
            };
            const data = e.response?.data;
            if (data?.error === 'addon_in_use') {
                alert(
                    `Cannot delete "${name}" — it&rsquo;s referenced by these presets:\n\n` +
                        (data.presets ?? []).map((p) => `• ${p}`).join('\n') +
                        '\n\nUpdate those presets first, then try again.',
                );
            } else if (data?.error === 'protected_addon') {
                alert(`"${name}" is a protected addon and cannot be deleted.`);
            } else {
                alert('Delete failed: ' + (err as Error).message);
            }
        }
    }

    const list = (addons ?? []).slice().sort((a, b) => {
        // BentoBox is the core plugin — always pin it to the top.
        if (a.name === 'BentoBox') return -1;
        if (b.name === 'BentoBox') return 1;
        if (a.gamemode !== b.gamemode) return a.gamemode ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    return (
        <div>
            <div css={tw`flex items-baseline justify-between mb-4 gap-3`}>
                <div>
                    <h3 css={tw`text-lg font-semibold m-0`}>Addons</h3>
                    <p css={tw`text-sm text-gray-600 m-0 mt-1`}>
                        Add, edit, and remove addons. Each addon&rsquo;s editor includes its
                        per-Minecraft-version mappings. Deletion is blocked while a preset still
                        references the addon.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setCreating(true);
                        setExpanded(null);
                    }}
                    disabled={creating}
                    css={tw`px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm flex items-center gap-2 flex-shrink-0 disabled:opacity-50`}
                    style={{
                        border: '1px solid var(--bb-line-strong)',
                        cursor: creating ? 'not-allowed' : 'pointer',
                    }}
                >
                    <FontAwesomeIcon icon={faPlus} />
                    Add addon
                </button>
            </div>

            {creating && (
                <div css={tw`mb-3 bg-white rounded border border-gray-300 p-3`}>
                    <div css={tw`font-medium mb-1`}>New addon</div>
                    <AddonEditor
                        initial={emptyAddon()}
                        creating
                        onSave={handleCreate}
                        onCancel={() => setCreating(false)}
                    />
                </div>
            )}

            <div css={tw`space-y-2`}>
                {list.map((a) => {
                    const isOpen = expanded === a.name;
                    const isProtected = PROTECTED.has(a.name);
                    const versionCount = a.versions ? Object.keys(a.versions).length : 0;
                    return (
                        <div
                            key={a.name}
                            css={tw`bg-white rounded border border-gray-200`}
                        >
                            <div css={tw`flex items-center gap-2 p-3`}>
                                <button
                                    type="button"
                                    onClick={() => setExpanded(isOpen ? null : a.name)}
                                    css={tw`flex items-center gap-2 flex-1 min-w-0 text-left`}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                                >
                                    <FontAwesomeIcon
                                        icon={isOpen ? faChevronDown : faChevronRight}
                                        style={{ width: 12, color: 'var(--bb-mute)' }}
                                    />
                                    <span css={tw`font-medium`}>{a.name}</span>
                                    <TypePill name={a.name} gamemode={a.gamemode} />
                                    {versionCount > 0 && (
                                        <span css={tw`text-xs text-gray-500`}>
                                            · {versionCount} legacy version
                                            {versionCount === 1 ? '' : 's'}
                                        </span>
                                    )}
                                </button>
                                <a
                                    href={`https://github.com/${a.github}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    css={tw`text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1 mr-2`}
                                    style={{ fontFamily: 'var(--bb-mono)' }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {a.github}
                                    <FontAwesomeIcon icon={faExternalLinkAlt} style={{ fontSize: 10 }} />
                                </a>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (
                                            confirm(`Delete addon "${a.name}"? This cannot be undone.`)
                                        ) {
                                            handleDelete(a.name);
                                        }
                                    }}
                                    disabled={isProtected}
                                    aria-label={isProtected ? `${a.name} is protected` : 'Delete addon'}
                                    title={
                                        isProtected ? `${a.name} is protected from deletion.` : 'Delete addon'
                                    }
                                    css={[
                                        tw`w-8 h-8 rounded flex items-center justify-center text-sm`,
                                        isProtected
                                            ? tw`text-gray-300 cursor-not-allowed`
                                            : tw`text-red-700 hover:bg-red-50`,
                                    ]}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: isProtected ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    <FontAwesomeIcon icon={faTrashAlt} />
                                </button>
                            </div>
                            {isOpen && (
                                <div css={tw`px-3 pb-3`}>
                                    <AddonEditor
                                        initial={a}
                                        creating={false}
                                        onSave={(next) => handleUpdate(a.name, next)}
                                        onCancel={() => setExpanded(null)}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function TypePill({ name, gamemode }: { name: string; gamemode: boolean }) {
    if (name === 'BentoBox') {
        return (
            <span css={tw`text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800`}>
                Core plugin
            </span>
        );
    }
    return (
        <span
            css={[
                tw`text-xs px-2 py-0.5 rounded`,
                gamemode ? tw`bg-green-100 text-green-800` : tw`bg-gray-100 text-gray-700`,
            ]}
        >
            {gamemode ? 'Game mode' : 'Addon'}
        </span>
    );
}

function emptyAddon(): AddonsEntity {
    return {
        name: '',
        github: 'BentoBoxWorld/' as AddonsEntity['github'],
        ci: 'BentoBoxWorld/',
        description: '',
        gamemode: false,
    };
}
