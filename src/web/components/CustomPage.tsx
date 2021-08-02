import React, { useEffect, useState } from 'react';
import tw from 'twin.macro';
import { GetAddons } from '../ApiRequestManager';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { useForm } from 'react-hook-form';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload } from '@fortawesome/free-solid-svg-icons';

export default function CustomPage() {
    const [addons, setAddons] = useState<JSX.Element[]>([]);
    const [gamemodes, setGamemodes] = useState<JSX.Element[]>([]);
    const [popupTitle, setPopupTitle] = useState('Start crafting your BentoBox!');
    const [popupText, setPopupText] = useState(
        '**[BentoBox](https://bentobox.world/)** is a plugin that does nothing on its own, but once you add Gamemodes and Addons to it, it becomes an incredible playground for your players, with countless possible combinations that will allow you to highly customize your server.\n\nCrafting your own BentoBox is the first step to join a world of never-ending possibilities of games and fun.',
    );

    const { register, getValues } = useForm();

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
                            .filter((key) => key != 'beta')
                            .filter((key) => values[key]);
                        open(
                            `/api/generate?downloads=${encodeURI(
                                '[' + addons.map((a) => '"' + a + '"').join(',') + ']',
                            )}${`&beta=${values.beta}`}`,
                        );
                    }}
                >
                    Generate Setup
                </button>
            );
        }
    }

    async function updateAddons() {
        const addons = await GetAddons();
        setAddons(
            addons
                .filter((a) => !a.gamemode)
                .map((addon) => {
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
                                    css={tw`bg-blue-500 rounded-md text-white px-1 ml-auto`}
                                    onClick={() => window.open('https://github.com/' + addon.github)}
                                >
                                    v{addon.version}
                                </button>
                                <div css={tw`bg-green-500 rounded-md text-white px-1 ml-2 flex flex-row flex-nowrap`}>
                                    <div css={tw`mx-1`}>
                                        <FontAwesomeIcon icon={faDownload} />
                                    </div>
                                    {nFormatter(addon.downloads!, 1)}
                                </div>
                            </label>
                        </div>
                    );
                }),
        );
        setGamemodes(
            addons
                .filter((a) => a.gamemode)
                .map((gamemode) => {
                    return (
                        <div key={gamemode.name}>
                            <label
                                css={tw`inline-flex items-center cursor-pointer w-full`}
                                onMouseEnter={() => {
                                    setPopupTitle(gamemode.name);
                                    setPopupText(gamemode.description);
                                }}
                            >
                                <input
                                    type="checkbox"
                                    css={tw`form-checkbox bg-gray-300 md:bg-white`}
                                    {...register(gamemode.name, { required: true })}
                                />
                                <span css={tw`ml-2`}>{gamemode.name}</span>
                                <button
                                    css={tw`bg-blue-500 rounded-md text-white px-1 ml-auto`}
                                    onClick={() => window.open('https://github.com/' + gamemode.github)}
                                >
                                    v{gamemode.version}
                                </button>
                                <div css={tw`bg-green-500 rounded-md text-white px-1 ml-2 flex flex-row flex-nowrap`}>
                                    <div css={tw`mx-1`}>
                                        <FontAwesomeIcon icon={faDownload} />
                                    </div>
                                    {nFormatter(gamemode.downloads!, 1)}
                                </div>
                            </label>
                        </div>
                    );
                }),
        );
    }

    useEffect(() => {
        updateAddons().then();
    }, []);

    return (
        <div css={tw`flex`}>
            <div
                css={`
                    ${tw`flex-grow flex-shrink block p-2 flex flex-col`} flex-basis: 0
                `}
            >
                <Generator />
                <div css={tw`mx-auto`}>
                    <input
                        type="checkbox"
                        css={tw`form-checkbox bg-gray-300 md:bg-white`}
                        {...register('beta', { required: true })}
                    />
                    &nbsp;Beta
                </div>
                <div css={tw`block mt-1`}>
                    <h2 css={tw`text-gray-700 text-2xl font-semibold mb-2`}>Select Gamemodes</h2>
                    <span css={tw`text-gray-700`}>Gamemodes bring in original games to your server.</span>
                    <form css={tw`mt-2 ml-4`}>{gamemodes}</form>
                </div>
                <div css={tw`block mt-5`}>
                    <h2 css={tw`text-gray-700 text-2xl font-semibold mb-2`}>Select Addons</h2>
                    <span css={tw`text-gray-700`}>
                        {"Addons enhance the player's experience and make your server unique by adding new features."}
                    </span>
                    <form css={tw`mt-2 ml-4`} id={'addons'}>
                        {addons}
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
