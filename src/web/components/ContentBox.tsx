import React, { Suspense } from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import tw from 'twin.macro';
import Navigation from './Navigation';
import { GetAddons, GetPresets } from '../ApiRequestManager';
import { Async } from 'react-async';

const PresetsPage = React.lazy(() => import('./PresetsPage'));
const CustomPage = React.lazy(() => import('./CustomPage'));

export default function ContentBox() {
    const addonTypes = () => GetAddons().then((res) => res);
    const presets = () => GetPresets().then((res) => res);
    return (
        <div css={tw`m-0 md:mx-auto md:my-12 bg-yellow-50 bg-opacity-75 md:w-3/4 max-w-screen-lg p-12 min-h-screen`}>
            <Router>
                <Navigation />
                <Switch>
                    <Route path="/custom">
                        <Suspense fallback={<div />}>
                            <Async promiseFn={addonTypes}>
                                {({ data, isLoading }) => {
                                    if (isLoading) return <></>;
                                    if (data) return <CustomPage addonTypes={data} />;
                                }}
                            </Async>
                        </Suspense>
                    </Route>
                    <Route path={'/'}>
                        <Suspense fallback={<div />}>
                            <Async promiseFn={presets}>
                                {({ data, isLoading }) => {
                                    if (isLoading) return <></>;
                                    if (data) return <PresetsPage presets={data} />;
                                }}
                            </Async>
                        </Suspense>
                    </Route>
                </Switch>
            </Router>
            <div css={tw`w-full h-12 flex text-center`}>
                <div css={tw`mx-auto mt-auto`}>
                    Site By&nbsp;<a href={'https://github.com/Fredthedoggy'}>Fredthedoggy</a>
                    ,&nbsp;BentoBox&nbsp;&amp;&nbsp;BentoBoxWorld by&nbsp;
                    <a href={'https://github.com/tastybento'}>tastybento</a>&nbsp;and&nbsp;
                    <a href={'https://github.com/poslovitch'}>Poslovitch</a>&nbsp;
                </div>
            </div>
        </div>
    );
}
