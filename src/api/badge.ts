/**
 * Self-hosted SVG badges in the shields.io visual language, so README badges
 * don't depend on a third-party renderer. Text widths are estimated from a
 * Verdana 11px table; `textLength` makes the renderer fit the text exactly to
 * the box we computed, so small estimation errors never overflow.
 */

export type BadgeStyle = 'flat' | 'flat-square' | 'for-the-badge';

export interface BadgeOptions {
    label: string;
    message: string;
    /** Message (right-hand) background, as a CSS colour. */
    color: string;
    /** Label (left-hand) background, as a CSS colour. */
    labelColor: string;
    style: BadgeStyle;
    logo: boolean;
}

export const BRAND_GREEN = '#3f8f45';
export const BRAND_INK = '#2a2f3a';

const NAMED_COLORS: Record<string, string> = {
    green: BRAND_GREEN,
    brightgreen: '#4c1',
    blue: '#007ec6',
    orange: '#fe7d37',
    amber: '#dfb317',
    red: '#e05d44',
    grey: '#555',
    gray: '#555',
    ink: BRAND_INK,
    discord: '#5865f2',
};

/** Accepts a named colour or a 3/6-digit hex (with or without '#'); anything else → fallback. */
export function parseColor(input: unknown, fallback: string): string {
    if (typeof input !== 'string' || input.length === 0 || input.length > 20) return fallback;
    const lower = input.toLowerCase();
    if (NAMED_COLORS[lower]) return NAMED_COLORS[lower];
    const hex = lower.replace(/^#/, '');
    return /^([0-9a-f]{3}|[0-9a-f]{6})$/.test(hex) ? `#${hex}` : fallback;
}

export function parseStyle(input: unknown): BadgeStyle {
    return input === 'flat-square' || input === 'for-the-badge' ? input : 'flat';
}

// Approximate advance widths for Verdana 11px.
const WIDTHS: Record<string, number> = {
    ' ': 3.9,
    '!': 4.6,
    '#': 9.0,
    '%': 11.9,
    '(': 4.6,
    ')': 4.6,
    '+': 9.2,
    ',': 3.6,
    '-': 4.9,
    '.': 3.6,
    '/': 4.9,
    ':': 4.6,
    '–': 7.0,
    i: 3.1,
    j: 3.4,
    l: 3.1,
    f: 3.9,
    t: 4.3,
    r: 4.7,
    m: 10.7,
    w: 8.9,
    I: 4.6,
    J: 5.0,
    M: 9.4,
    W: 10.9,
};

function textWidth(text: string): number {
    let w = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text.charAt(i);
        if (WIDTHS[c] !== undefined) w += WIDTHS[c];
        else if (c >= '0' && c <= '9') w += 7.0;
        else if (c >= 'A' && c <= 'Z') w += 7.5;
        else w += 6.6;
    }
    return w;
}

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** A tiny three-compartment bento box, 14×14, drawn in white. */
function logoSvg(x: number, y: number): string {
    return (
        `<g fill="#fff" transform="translate(${x} ${y})">` +
        '<rect width="14" height="6" rx="1.5"/>' +
        '<rect y="7.5" width="6.25" height="6.5" rx="1.5"/>' +
        '<rect x="7.75" y="7.5" width="6.25" height="6.5" rx="1.5"/>' +
        '</g>'
    );
}

/** Standalone logo, for the shields.io endpoint's `logoSvg` field. */
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14">${logoSvg(0, 0)}</svg>`;

export function renderBadge(o: BadgeOptions): string {
    return o.style === 'for-the-badge' ? renderLarge(o) : renderFlat(o);
}

function renderFlat(o: BadgeOptions): string {
    const square = o.style === 'flat-square';
    const logoW = o.logo ? 19 : 0; // 14px glyph + 5px gap
    const labelW = Math.round(textWidth(o.label));
    const msgW = Math.round(textWidth(o.message));
    const left = labelW + 10 + logoW;
    const right = msgW + 10;
    const total = left + right;
    const labelX = logoW + 5 + labelW / 2;
    const msgX = left + 5 + msgW / 2;
    const title = esc(`${o.label}: ${o.message}`);

    const text = (x: number, w: number, s: string) =>
        (square ? '' : `<text x="${x}" y="15" fill="#010101" fill-opacity=".3" textLength="${w}">${esc(s)}</text>`) +
        `<text x="${x}" y="14" textLength="${w}">${esc(s)}</text>`;

    return (
        `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${title}">` +
        `<title>${title}</title>` +
        (square
            ? ''
            : '<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/>' +
              '<stop offset="1" stop-opacity=".1"/></linearGradient>') +
        `<clipPath id="r"><rect width="${total}" height="20" rx="${square ? 0 : 3}" fill="#fff"/></clipPath>` +
        '<g clip-path="url(#r)">' +
        `<rect width="${left}" height="20" fill="${o.labelColor}"/>` +
        `<rect x="${left}" width="${right}" height="20" fill="${o.color}"/>` +
        (square ? '' : `<rect width="${total}" height="20" fill="url(#s)"/>`) +
        '</g>' +
        '<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" ' +
        'text-rendering="geometricPrecision" font-size="11">' +
        text(labelX, labelW, o.label) +
        text(msgX, msgW, o.message) +
        '</g>' +
        (o.logo ? logoSvg(5, 3) : '') +
        '</svg>'
    );
}

function renderLarge(o: BadgeOptions): string {
    const label = o.label.toUpperCase();
    const message = o.message.toUpperCase();
    const width = (s: string, bold: boolean) =>
        Math.round(textWidth(s) * (10 / 11) * (bold ? 1.1 : 1) + 1.25 * Math.max(0, s.length - 1));
    const logoW = o.logo ? 20 : 0; // 14px glyph + 6px gap
    const labelW = width(label, false);
    const msgW = width(message, true);
    const left = labelW + 24 + logoW;
    const right = msgW + 24;
    const total = left + right;
    const title = esc(`${o.label}: ${o.message}`);

    return (
        `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="28" role="img" aria-label="${title}">` +
        `<title>${title}</title>` +
        `<rect width="${left}" height="28" fill="${o.labelColor}"/>` +
        `<rect x="${left}" width="${right}" height="28" fill="${o.color}"/>` +
        '<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" ' +
        'text-rendering="geometricPrecision" font-size="10" letter-spacing="1.25">' +
        `<text x="${logoW + 12 + labelW / 2}" y="18" textLength="${labelW}">${esc(label)}</text>` +
        `<text x="${left + 12 + msgW / 2}" y="18" font-weight="bold" textLength="${msgW}">${esc(message)}</text>` +
        '</g>' +
        (o.logo ? logoSvg(10, 7) : '') +
        '</svg>'
    );
}
