import * as PIXI from 'pixi.js';

const SUIT_SYMBOLS = { 'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠' };
const SUIT_COLORS = { 'H': '#e53e3e', 'D': '#e53e3e', 'C': '#1a202c', 'S': '#1a202c' };

const textureCache = new Map();

function generateCardSvgString(suit, rank, isJoker = false, faceDown = false) {
    const width = 100;
    const height = 140;

    if (faceDown) {
        return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" width="${width}" height="${height}">
            <rect x="2" y="2" width="96" height="136" rx="8" fill="#ffffff" stroke="#cbd5e0" stroke-width="2"/>
            <rect x="5" y="5" width="90" height="130" rx="6" fill="#1a365d"/>
            <pattern id="cardBackPattern" width="12" height="12" patternUnits="userSpaceOnUse">
                <path d="M 6 0 L 12 6 L 6 12 L 0 6 Z" fill="none" stroke="#2b6cb0" stroke-width="1.2"/>
                <circle cx="6" cy="6" r="2" fill="#63b3ed" opacity="0.6"/>
            </pattern>
            <rect x="8" y="8" width="84" height="124" rx="4" fill="url(#cardBackPattern)"/>
            <circle cx="50" cy="70" r="18" fill="#1a365d" stroke="#63b3ed" stroke-width="2"/>
            <text x="50" y="75" font-family="sans-serif" font-size="13" font-weight="900" fill="#ebf8ff" text-anchor="middle">RUMMY</text>
        </svg>`;
    }

    if (isJoker || suit === 'JOKER' || rank === 'JOKER') {
        return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" width="${width}" height="${height}">
            <rect x="2" y="2" width="96" height="136" rx="8" fill="#ffffff" stroke="#ecc94b" stroke-width="3"/>
            <rect x="4" y="4" width="92" height="132" rx="6" fill="#fefcbf" opacity="0.35"/>
            <text x="13" y="24" font-family="sans-serif" font-size="21" font-weight="900" fill="#d69e2e" text-anchor="middle">J</text>
            <text x="13" y="37" font-family="sans-serif" font-size="11.5" font-weight="bold" fill="#d69e2e" text-anchor="middle">O</text>
            <text x="13" y="48" font-family="sans-serif" font-size="11.5" font-weight="bold" fill="#d69e2e" text-anchor="middle">K</text>
            <text x="13" y="59" font-family="sans-serif" font-size="11.5" font-weight="bold" fill="#d69e2e" text-anchor="middle">E</text>
            <text x="13" y="70" font-family="sans-serif" font-size="11.5" font-weight="bold" fill="#d69e2e" text-anchor="middle">R</text>
            <text x="50" y="85" font-size="44" text-anchor="middle">🃏</text>
            <text x="50" y="118" font-family="sans-serif" font-size="10" font-weight="900" fill="#744210" text-anchor="middle">PRINTED JOKER</text>
        </svg>`;
    }

    const symbol = SUIT_SYMBOLS[suit] || '';
    const color = SUIT_COLORS[suit] || '#1a202c';
    const isTen = rank === '10';

    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" width="${width}" height="${height}">
        <rect x="2" y="2" width="96" height="136" rx="8" fill="#ffffff" stroke="#cbd5e0" stroke-width="2"/>
        <text x="${isTen ? '13' : '12'}" y="25" font-family="sans-serif" font-size="20" font-weight="900" fill="${color}" text-anchor="middle">${rank}</text>
        <text x="12" y="43" font-family="sans-serif" font-size="18" fill="${color}" text-anchor="middle">${symbol}</text>
        <text x="50" y="85" font-family="sans-serif" font-size="44" fill="${color}" text-anchor="middle">${symbol}</text>
        <g transform="rotate(180 50 70)">
            <text x="${isTen ? '13' : '12'}" y="25" font-family="sans-serif" font-size="20" font-weight="900" fill="${color}" text-anchor="middle">${rank}</text>
            <text x="12" y="43" font-family="sans-serif" font-size="18" fill="${color}" text-anchor="middle">${symbol}</text>
        </g>
    </svg>`;
}

export function getCardTexture(suit, rank, isJoker = false, faceDown = false) {
    const key = faceDown ? 'BACK' : (isJoker ? 'JOKER' : `${rank}_${suit}`);
    if (textureCache.has(key)) {
        return textureCache.get(key);
    }

    const svgString = generateCardSvgString(suit, rank, isJoker, faceDown);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const texture = PIXI.Texture.from(url);
    textureCache.set(key, texture);
    return texture;
}
