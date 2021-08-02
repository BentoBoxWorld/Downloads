import React, { useEffect, useState } from 'react';
import PremadeCard from './PremadeCard';
import tw from 'twin.macro';
import { GetPresets } from '../ApiRequestManager';

export default function PresetsPage() {
    const [presets, setPresets] = useState<JSX.Element[]>([]);

    async function updatePresets() {
        const presets = await GetPresets();
        setPresets(
            presets.map((preset) => {
                return (
                    <PremadeCard
                        key={preset.name}
                        name={preset.name}
                        description={preset.description}
                        subtext={preset.subtext}
                        addons={preset.addons}
                        color={preset.color}
                        dependencies={preset.dependencies || undefined}
                        dependencyText={preset.dependencyText || undefined}
                    />
                );
            }),
        );
    }

    useEffect(() => {
        updatePresets().then();
    }, []);

    return <div css={tw`flex flex-wrap flex-grow`}>{presets}</div>;
}
