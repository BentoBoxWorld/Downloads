import React from 'react';
import PremadeCard from './PremadeCard';
import tw from 'twin.macro';
import { PresetsEntity } from '../../config';

export default function PresetsPage(props: { presets: PresetsEntity[] }) {
    const { presets } = props;
    return (
        <div css={tw`flex flex-wrap flex-grow`}>
            {presets.map((preset) => {
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
            })}
        </div>
    );
}
