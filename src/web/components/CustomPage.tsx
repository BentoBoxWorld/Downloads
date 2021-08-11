import React, { useState } from 'react';
import tw from 'twin.macro';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { useForm } from 'react-hook-form';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload } from '@fortawesome/free-solid-svg-icons';
import { AddonType } from '../../config';

export default function CustomPage(props: { addonTypes: AddonType[] }) {
    const { addonTypes } = props;
    const [popupTitle, setPopupTitle] = useState('Start crafting your BentoBox!');
    const [popupText, setPopupText] = useState(
        '**[BentoBox](https://bentobox.world/)** is a plugin that does nothing on its own, but once you add Gamemodes and Addons to it, it becomes an incredible playground for your players, with countless possible combinations that will allow you to highly customize your server.\n\nCrafting your own BentoBox is the first step to join a world of never-ending possibilities of games and fun.',
    );
    const { register, getValues, watch } = useForm();

    const value = watch('version');

    function nFormatter(num: number, digits: number): string {
        const lookup = [
            { value: 1, symbol: '' },
            { value: 1e3, symbol: 'k' },
            { value: 1e6, symbol: 'M' },
            { value: 1e9, symbol: 'G' },
            { value: 1e12, symbol: 'T' },
            { value: 1e15, symbol: 'P' },
            { value: 1e18, symbol: 'E' },
        ];
        const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
        const item = lookup
            .slice()
            .reverse()
            .find(function (item) {
                return num >= item.value;
            });
        return item ? (num / item.value).toFixed(digits).replace(rx, '$1') + item.symbol : '0';
    }

    class Generator extends React.Component {
        render() {
            return (
                <button
                    css={tw`flex-grow flex-shrink block p-2 bg-green-400 text-white rounded-lg mx-auto my-2 focus:outline-none focus:border-none`}
                    onClick={() => {
                        const values = getValues();
                        const addons = Object.keys(values)
                            .filter((key) => key != 'version')
                            .filter((key) => values[key]);
                        if (addons.length < 1) return;
                        if (Object.keys(values).length <= 2) return;
                        open(
                            `/api/generate?downloads=${encodeURI(
                                '[' + addons.map((a) => '"' + a + '"').join(',') + ']',
                            )}&version=${values.version}`,
                        );
                    }}
                >
                    Generate Setup
                </button>
            );
        }
    }

    function addons(version: string) {
        return getAddonElements(false, addonTypes, version);
    }

    function gamemodes(version: string) {
        return getAddonElements(true, addonTypes, version);
    }

    function getAddonElements(isGamemode: boolean, addons: AddonType[], inVersion: string): JSX.Element[] {
        return addons
            .filter((a) => a.gamemode === isGamemode)
            .map((addon) => {
                let version: string;
                let color = '#3b82f6';
                if (inVersion === 'beta') {
                    version = 'b-' + addon.ci;
                    color = '#f72811';
                } else {
                    version = 'v' + addon.version;
                }
                return (
                    <div key={addon.name}>
                        <label
                            css={tw`inline-flex items-center cursor-pointer w-full`}
                            onMouseEnter={() => {
                                setPopupTitle(addon.name);
                                setPopupText(addon.description);
                            }}
                        >
                            <input
                                type="checkbox"
                                css={tw`form-checkbox bg-gray-300 md:bg-white`}
                                {...register(addon.name, { required: true })}
                            />
                            <span css={tw`ml-2`}>{addon.name}</span>
                            <button
                                css={`
                                    ${tw`rounded-md text-white px-1 ml-auto`} background-color: ${color}
                                `}
                                onClick={() => window.open('https://github.com/' + addon.github)}
                            >
                                {version}
                            </button>
                            <div css={tw`bg-green-500 rounded-md text-white px-1 ml-2 flex flex-row flex-nowrap`}>
                                <div css={tw`mx-1`}>
                                    <FontAwesomeIcon icon={faDownload} />
                                </div>
                                {nFormatter(addon.downloads || 0, 1)}
                            </div>
                        </label>
                    </div>
                );
            });
    }

    return (
        <div css={tw`flex flex-col md:flex-row`}>
            <div
                css={`
                    ${tw`flex-grow flex-shrink block p-2 flex flex-col`} flex-basis: 0
                `}
            >
                <Generator />
                <div css={tw`mx-auto`}>
                    <select {...register('version', { required: true })}>
                        <option value="latest">Latest</option>
                        <option value="beta">CI (Beta)</option>
                    </select>
                </div>
                <div css={tw`block mt-1`}>
                    <h2 css={tw`text-gray-700 text-2xl font-semibold mb-2`}>Select Gamemodes</h2>
                    <span css={tw`text-gray-700`}>Gamemodes bring in original games to your server.</span>
                    <form css={tw`mt-2 ml-4`}>{gamemodes(value)}</form>
                </div>
                <div css={tw`block mt-5`}>
                    <h2 css={tw`text-gray-700 text-2xl font-semibold mb-2`}>Select Addons</h2>
                    <span css={tw`text-gray-700`}>
                        {"Addons enhance the player's experience and make your server unique by adding new features."}
                    </span>
                    <form css={tw`mt-2 ml-4`} id={'addons'}>
                        {addons(value)}
                    </form>
                </div>
                <Generator />
            </div>
            <div
                css={`
                    ${tw`flex-grow flex-shrink block p-2`} flex-basis: 0
                `}
            >
                <div css={tw`bg-white w-full rounded-lg overflow-hidden h-content sticky top-10`}>
                    <div
                        css={`
                            ${tw`w-full text-white font-bold text-lg p-3`} background-color: #3298dc
                        `}
                    >
                        <ReactMarkdown>{popupTitle}</ReactMarkdown>
                    </div>
                    <div
                        css={`
                            ${tw`px-6 py-4`} color: #1d72aa
                        `}
                    >
                        <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                            {popupText.replace('\n', '\n&numsp;')}
                        </ReactMarkdown>
                    </div>
                </div>
            </div>
        </div>
    );
}
