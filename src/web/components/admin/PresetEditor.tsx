import React from 'react';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { AddonType, PresetsEntity } from '../../../config';

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

interface Props {
    preset: PresetsEntity;
    addons: AddonType[];
    onChange: (next: PresetsEntity) => void;
}

export default function PresetEditor({ preset, addons, onChange }: Props) {
    function set<K extends keyof PresetsEntity>(key: K, value: PresetsEntity[K]) {
        onChange({ ...preset, [key]: value });
    }

    function toggleAddon(key: 'addons' | 'dependencies', name: string) {
        const current = (preset[key] as string[] | undefined) ?? [];
        const next = current.includes(name)
            ? current.filter((n) => n !== name)
            : [...current, name];
        if (key === 'dependencies' && next.length === 0) {
            // Drop empty dependencies arrays so the JSON stays clean.
            const { dependencies: _drop, ...rest } = preset;
            onChange(rest as PresetsEntity);
            return;
        }
        onChange({ ...preset, [key]: next });
    }

    const selectedAddons = preset.addons ?? [];
    const selectedDeps = preset.dependencies ?? [];

    return (
        <div css={tw`grid gap-4 mt-4 pt-4 border-t border-gray-200`}>
            <div css={tw`grid gap-4`} style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div>
                    <label style={labelStyle}>Name</label>
                    <input
                        type="text"
                        value={preset.name}
                        onChange={(e) => set('name', e.target.value)}
                        style={inputStyle}
                    />
                </div>
                <div>
                    <label style={labelStyle}>Highlight color</label>
                    <div css={tw`flex items-center gap-2`}>
                        <input
                            type="color"
                            value={normalizeHex(preset.color)}
                            onChange={(e) => set('color', e.target.value)}
                            style={{
                                width: 48,
                                height: 36,
                                padding: 2,
                                border: '1px solid var(--bb-line-strong)',
                                borderRadius: 6,
                                background: '#fff',
                                cursor: 'pointer',
                            }}
                        />
                        <input
                            type="text"
                            value={preset.color}
                            onChange={(e) => set('color', e.target.value)}
                            style={{ ...inputStyle, fontFamily: 'var(--bb-mono)', flex: 1 }}
                            placeholder="#ffdd57"
                        />
                    </div>
                </div>
            </div>

            <div>
                <label style={labelStyle}>Description (short pitch)</label>
                <input
                    type="text"
                    value={preset.description}
                    onChange={(e) => set('description', e.target.value)}
                    style={inputStyle}
                />
            </div>

            <div>
                <label style={labelStyle}>Subtext (longer description shown below)</label>
                <textarea
                    value={preset.subtext}
                    onChange={(e) => set('subtext', e.target.value)}
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                />
            </div>

            <div>
                <label style={labelStyle}>
                    Addons <span css={tw`text-gray-400 normal-case`}>({selectedAddons.length} selected)</span>
                </label>
                <ChipPicker
                    addons={addons}
                    selected={selectedAddons}
                    onToggle={(n) => toggleAddon('addons', n)}
                />
            </div>

            <div>
                <label style={labelStyle}>
                    Dependencies (optional){' '}
                    <span css={tw`text-gray-400 normal-case`}>({selectedDeps.length} selected)</span>
                </label>
                <ChipPicker
                    addons={addons}
                    selected={selectedDeps}
                    onToggle={(n) => toggleAddon('dependencies', n)}
                />
                <input
                    type="text"
                    value={preset.dependencyText ?? ''}
                    onChange={(e) =>
                        onChange({
                            ...preset,
                            dependencyText: e.target.value || undefined,
                        })
                    }
                    placeholder="Optional text shown next to dependencies (e.g. 'Requires Vault')"
                    style={{ ...inputStyle, marginTop: 8, fontSize: 13 }}
                />
            </div>
        </div>
    );
}

function ChipPicker({
    addons,
    selected,
    onToggle,
}: {
    addons: AddonType[];
    selected: string[];
    onToggle: (name: string) => void;
}) {
    const sorted = [...addons].filter((a) => a.name.toLowerCase() !== 'bentobox').sort((a, b) => {
        if (a.gamemode !== b.gamemode) return a.gamemode ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
    return (
        <div
            css={tw`flex flex-wrap gap-1 p-2 border border-gray-200 rounded bg-gray-50`}
            style={{ maxHeight: 200, overflowY: 'auto' }}
        >
            {sorted.map((a) => {
                const isSelected = selected.includes(a.name);
                return (
                    <button
                        key={a.name}
                        type="button"
                        onClick={() => onToggle(a.name)}
                        css={[
                            tw`text-xs px-2 py-1 rounded inline-flex items-center gap-1.5`,
                            isSelected
                                ? tw`bg-gray-900 text-white`
                                : tw`bg-white text-gray-700 border border-gray-200 hover:border-gray-400`,
                            a.gamemode && !isSelected ? tw`border-gray-400 font-medium` : tw``,
                        ]}
                        style={{
                            cursor: 'pointer',
                            border: isSelected ? 'none' : undefined,
                        }}
                        title={a.gamemode ? 'Game mode' : 'Addon'}
                    >
                        {isSelected && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10 }} />}
                        {a.name}
                    </button>
                );
            })}
        </div>
    );
}

function normalizeHex(c: string): string {
    if (/^#[0-9a-fA-F]{6}$/.test(c)) return c;
    if (/^#[0-9a-fA-F]{3}$/.test(c)) {
        // expand short form
        return '#' + c.slice(1).split('').map((ch) => ch + ch).join('');
    }
    return '#888888';
}
