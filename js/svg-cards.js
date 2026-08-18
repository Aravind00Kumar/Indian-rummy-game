// SVG Playing Cards Generator
// Creates lightweight, scalable vector graphic elements for playing cards

const SVG_CARDS = (function() {
    const SUIT_SYMBOLS = {
        'H': '♥',
        'D': '♦',
        'C': '♣',
        'S': '♠'
    };

    const SUIT_COLORS = {
        'H': '#e53e3e',
        'D': '#e53e3e',
        'C': '#1a202c',
        'S': '#1a202c'
    };

    const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

    function getCardSvg(card, options = {}) {
        const { isJoker = false, isWild = false, faceDown = false, width = 90, height = 126 } = options;

        if (faceDown) {
            return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" width="${width}" height="${height}" class="playing-card card-back">
                <rect x="2" y="2" width="96" height="136" rx="8" fill="#ffffff" stroke="#cbd5e0" stroke-width="2"/>
                <rect x="5" y="5" width="90" height="130" rx="6" fill="#1a365d"/>
                <pattern id="cardBackPattern" width="12" height="12" patternUnits="userSpaceOnUse">
                    <path d="M 6 0 L 12 6 L 6 12 L 0 6 Z" fill="none" stroke="#2b6cb0" stroke-width="1.2"/>
                    <circle cx="6" cy="6" r="2" fill="#63b3ed" opacity="0.6"/>
                </pattern>
                <rect x="8" y="8" width="84" height="124" rx="4" fill="url(#cardBackPattern)"/>
                <circle cx="50" cy="70" r="18" fill="#1a365d" stroke="#63b3ed" stroke-width="2"/>
                <text x="50" y="75" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="900" fill="#ebf8ff" text-anchor="middle">RUMMY</text>
            </svg>`;
        }

        if (isJoker || (card && card.suit === 'JOKER')) {
            return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" width="${width}" height="${height}" class="playing-card card-joker">
                <rect x="2" y="2" width="96" height="136" rx="8" fill="#ffffff" stroke="#ecc94b" stroke-width="3"/>
                <rect x="4" y="4" width="92" height="132" rx="6" fill="#fefcbf" opacity="0.35"/>
                <text x="13" y="24" font-family="system-ui, -apple-system, sans-serif" font-size="21" font-weight="900" fill="#d69e2e" text-anchor="middle">J</text>
                <text x="13" y="37" font-family="system-ui, -apple-system, sans-serif" font-size="11.5" font-weight="bold" fill="#d69e2e" text-anchor="middle">O</text>
                <text x="13" y="48" font-family="system-ui, -apple-system, sans-serif" font-size="11.5" font-weight="bold" fill="#d69e2e" text-anchor="middle">K</text>
                <text x="13" y="59" font-family="system-ui, -apple-system, sans-serif" font-size="11.5" font-weight="bold" fill="#d69e2e" text-anchor="middle">E</text>
                <text x="13" y="70" font-family="system-ui, -apple-system, sans-serif" font-size="11.5" font-weight="bold" fill="#d69e2e" text-anchor="middle">R</text>
                <text x="50" y="82" font-size="46" text-anchor="middle">🃏</text>
                <text x="50" y="114" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="900" fill="#744210" text-anchor="middle">PRINTED JOKER</text>
            </svg>`;
        }

        const suit = card.suit;
        const rank = card.rank;
        const symbol = SUIT_SYMBOLS[suit] || '';
        const color = SUIT_COLORS[suit] || '#1a202c';
        const isRed = suit === 'H' || suit === 'D';
        const isTen = rank === '10';

        // Size ranking numbers and corner symbols (+15% further increase for corner visibility)
        const rankFontSize = isTen ? '30.5' : '33.5';
        const symbolFontSize = '26.5';
        const centerSymbolSize = '48';

        return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" width="${width}" height="${height}" class="playing-card ${isRed ? 'red-card' : 'black-card'} ${isWild ? 'wild-joker' : ''}">
            <rect x="2" y="2" width="96" height="136" rx="8" fill="#ffffff" stroke="${isWild ? '#dd6b20' : '#cbd5e0'}" stroke-width="${isWild ? '3' : '1.5'}"/>
            ${isWild ? '<rect x="4" y="4" width="92" height="132" rx="6" fill="#feebc8" opacity="0.45"/>' : ''}
            
            <!-- Top Left Corner: 15% Enlarged Rank & Suit Symbol -->
            <text x="15" y="28" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${rankFontSize}" font-weight="900" fill="${color}" text-anchor="middle" letter-spacing="-0.5">${rank}</text>
            <text x="15" y="53" font-size="${symbolFontSize}" fill="${color}" text-anchor="middle">${symbol}</text>
            
            <!-- Center: Clean Suit Symbol Only (for number and face cards) -->
            <text x="50" y="80" font-size="${centerSymbolSize}" fill="${color}" text-anchor="middle">
                ${symbol}
            </text>

            <!-- Bottom Right Corner (Inverted 180 deg) -->
            <g transform="rotate(180 50 70)">
                <text x="15" y="28" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${rankFontSize}" font-weight="900" fill="${color}" text-anchor="middle" letter-spacing="-0.5">${rank}</text>
                <text x="15" y="53" font-size="${symbolFontSize}" fill="${color}" text-anchor="middle">${symbol}</text>
            </g>

            ${isWild ? `
                <g transform="translate(54, 7)">
                    <rect width="38" height="16" rx="4" fill="#dd6b20"/>
                    <text x="19" y="12" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">JOKER</text>
                </g>
            ` : ''}
        </svg>`;
    }

    return {
        getCardSvg,
        SUIT_SYMBOLS,
        SUIT_COLORS,
        RANKS
    };
})();
