import React from 'react';
import PremadeCard from './PremadeCard';
import tw from 'twin.macro';
import { PresetsEntity } from '../../config';

export default function PresetsPage(props: { presets: PresetsEntity[] }) {
    const { presets } = props;
    const hash = location.hash.length < 2 ? undefined : location.hash.slice(1, location.hash.length);
    const preset = hash
        ? presets.filter((preset) => hash.toLowerCase() === preset.addons[0].toLowerCase())[0]
        : undefined;
    return (
        <>
            {!preset && (
                <div css={tw`bg-blue-300 rounded-lg p-3 mx-auto my-2 text-black text-center`}>
                    <p css={tw`text-2xl font-semibold`}>Download, or edit a preset!</p>
                    <p css={tw`text-lg`}>The download will include a stock set of addons to get you started!</p>
                </div>
            )}
            {preset && (
                <>
                    <div css={tw`bg-blue-300 rounded-lg p-3 mx-auto my-2 text-black text-center`}>
                        <p css={tw`text-2xl font-semibold`}>Download, or edit {hash}</p>
                        <p css={tw`text-lg`}>The download will include a stock set of addons to get you started!</p>
                    </div>
                    <PremadeCard
                        key={preset.name}
                        name={preset.name}
                        description={preset.description}
                        subtext={preset.subtext}
                        addons={preset.addons}
                        color={preset.color}
                        dependencies={preset.dependencies}
                        dependencyText={preset.dependencyText}
                    />
                    <div css={tw`bg-blue-300 rounded-lg p-3 mx-auto my-2 text-black text-center`}>
                        <p css={tw`text-2xl font-semibold`}>Or download these other awesome presets!</p>
                    </div>
                </>
            )}
            <div css={tw`flex flex-wrap flex-grow`}>
                {presets
                    .filter((preset) => !preset || hash != preset.addons[0])
                    .map((preset) => {
                        return (
                            <PremadeCard
                                key={preset.name}
                                name={preset.name}
                                description={preset.description}
                                subtext={preset.subtext}
                                addons={preset.addons}
                                color={preset.color}
                                dependencies={preset.dependencies}
                                dependencyText={preset.dependencyText}
                            />
                        );
                    })}
            </div>
        </>
    );
}
