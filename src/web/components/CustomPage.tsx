import React, { useEffect, useState } from 'react';
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
    const [versionTypes, setVersionTypes] = useState<Record<string, string[]>>({});
    const [versions, updateVersions] = useState<string[]>([]);
    const [popupText, setPopupText] = useState(
        '**[BentoBox](https://bentobox.world/)** is a plugin that does nothing on its own, but once you add Gamemodes and Addons to it, it becomes an incredible playground for your players, with countless possible combinations that will allow you to highly customize your server.\n\nCrafting your own BentoBox is the first step to join a world of never-ending possibilities of games and fun.',
    );
    const [copied, setCopied] = useState('Copy URL To Setup');
    const { register, getValues, setValue, watch } = useForm();

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
                            .filter((key) => values[key])
                            .filter((key) =>
                                Object.keys(addonTypes.filter((addon) => addon.name === key)[0]?.versions).includes(
                                    value,
                                ),
                            );
                        if (addons.length < 1) return;
                        if (Object.keys(values).length <= 2) return;
                        open(
                            `/api/generate?downloads=${encodeURI(
                                '[' + addons.map((a) => '"' + a + '"').join(',') + ']',
                            )}&version=${value}`,
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

    function setVersions() {
        const oldVersions = versionTypes;
        for (const addonsKey in addonTypes) {
            const versions = Object.keys(addonTypes[addonsKey].versions);
            if (!versions || Object.keys(versions).length < 1) return;
            oldVersions[addonsKey] = versions;
        }
        setVersionTypes(oldVersions);
        const versionValues = Object.values(versionTypes).flat(1);

        updateVersions(
            versionValues.filter(function (item, pos) {
                return item != 'latest' && item != 'beta' && versionValues.indexOf(item) == pos;
            }),
        );
    }

    function getAddonElements(isGamemode: boolean, addons: AddonType[], inVersion: string): JSX.Element[] {
        return addons
            .filter((a) => a.gamemode === isGamemode)
            .map((addon) => {
                let version = '';
                let color = '#efd112';
                if (inVersion === 'beta') {
                    version = 'b-' + addon.versions[inVersion];
                    color = '#f72811';
                } else {
                    if (addon.versions[inVersion]) version = 'v' + addon.versions[inVersion];
                }
                if (inVersion === 'latest') color = '#3b82f6';
                const enabled = Object.keys(addon.versions).includes(value);
                return (
                    <div key={addon.name}>
                        <label
                            css={`
                                ${tw`inline-flex items-center cursor-pointer w-full flex-wrap`}
                                ${!enabled && tw`opacity-50 cursor-pointer`}
                            `}
                            onMouseEnter={() => {
                                setPopupTitle(addon.name);
                                setPopupText(addon.description);
                            }}
                        >
                            <input
                                type="checkbox"
                                css={tw`form-checkbox bg-gray-300 md:bg-white
                                `}
                                {...register(addon.name, { required: true })}
                                disabled={!enabled}
                            />
                            <span css={tw`ml-2`}>{addon.name}</span>
                            <button
                                css={`
                                    ${tw`rounded-md text-white px-1 ml-auto`}
                                    background-color: ${color}
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

    useEffect(() => {
        setVersions();
        const hash = location.hash;
        if (hash.length < 2) return;
        let addonNames: string[];
        try {
            addonNames = JSON.parse(decodeURI(hash.slice(1, hash.length)));
        } catch (e) {
            console.error(e);
            return;
        }
        addonNames.forEach((addonName) => {
            setValue(addonName, true);
        });
    }, []);

    return (
        <div css={tw`flex flex-col md:flex-row`}>
            <div
                css={`
                    ${tw`flex-grow flex-shrink block p-2 flex flex-col`} flex-basis: 0
                `}
            >
                <Generator />
                <div css={tw`mx-auto`}>
                    Minecraft Version&nbsp;
                    <select {...register('version', { required: true })}>
                        <option value="latest">Latest</option>
                        <option value="beta">CI (Beta)</option>
                        {versions
                            .sort()
                            .reverse()
                            .map((version) => {
                                return (
                                    <option key={version} value={version}>
                                        {version}
                                    </option>
                                );
                            })}
                    </select>
                </div>
                <div
                    css={`
                        ${tw`mx-auto mt-3 mb-1 text-white rounded-lg p-2 text-center`}
                        ${value === 'latest' ? tw`bg-green-500` : value === 'beta' ? tw`bg-yellow-500` : tw`bg-red-600`}
                    `}
                >
                    {value === 'latest'
                        ? 'These Versions are for the Latest Version of Minecraft Only'
                        : value === 'beta'
                        ? 'Beta Versions Are Not Necessarily Stable. Use With Caution'
                        : 'These Versions May Be Old and Unsupported! Proceed With Caution'}
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
                <button
                    css={tw`flex-grow flex-shrink block p-2 bg-blue-400 text-white rounded-lg mx-auto my-2 focus:outline-none focus:border-none`}
                    onClick={() => {
                        const values = getValues();
                        const addons = Object.keys(values)
                            .filter((key) => key != 'version')
                            .filter((key) => values[key])
                            .filter((key) =>
                                Object.keys(addonTypes.filter((addon) => addon.name === key)[0]?.versions).includes(
                                    value,
                                ),
                            );
                        navigator.clipboard.writeText(
                            `https://download.bentobox.world/custom#${encodeURI(
                                '[' + addons.map((a) => '"' + a + '"').join(',') + ']',
                            )}`,
                        );
                        setCopied('Copied!');
                        setTimeout(() => {
                            setCopied('Copy URL To Setup');
                        }, 3000);
                    }}
                >
                    {copied}
                </button>
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
