import React from 'react';
import { createGlobalStyle } from 'styled-components';
import tw, { GlobalStyles as BaseStyles, theme } from 'twin.macro';

// Design tokens (palette, type, radii, shadows, button utilities) live in
// design-tokens.css. Imported here so it loads once at app boot via
// webpack's css-loader.
import './design-tokens.css';

const CustomStyles = createGlobalStyle`
  body {
    -webkit-tap-highlight-color: ${theme`colors.purple.500`};
    ${tw`antialiased`};
    /* The legacy 'md:bg-background' (back.jpg cover) is kept for routes
       OTHER than '/' — landing has its own hero backdrop. ContentBox sets
       a data-route attribute on the body so design-tokens.css can branch. */
    ${tw`md:bg-background md:bg-fixed md:bg-cover`};
  }
`;

const GlobalStyles = () => (
    <>
        <BaseStyles />
        <CustomStyles />
    </>
);

export default GlobalStyles;
