import React from 'react';
import PremadeCard from './PremadeCard';
import tw from 'twin.macro';
import { PresetsEntity } from '../../config';

export default function PresetsPage(props: { presets: PresetsEntity[] }) {
    const { presets } = props;
    return (
        <>
            <div css={tw`bg-blue-300 rounded-lg p-3 mx-auto my-2 text-black text-center`}>
                <p css={tw`text-2xl font-semibold`}>Click to download a preset!</p>
                <p css={tw`text-lg`}>The download will include a stock set of addons to get you started!</p>
            </div>
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
        </>
    );
}
