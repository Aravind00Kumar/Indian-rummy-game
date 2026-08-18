// Rummy Validation & Rules Engine (ES Module)
// Validates Pure Sequences, Impure Sequences, Sets, and calculates penalty scores

const RANK_VALUES = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 10, 'Q': 10, 'K': 10, 'A': 10, 'JOKER': 0
};

export function isWildJoker(card, wildRank) {
    if (!card) return false;
    if (card.suit === 'JOKER' || card.rank === 'JOKER') return true;
    return card.rank === wildRank;
}

export function getCardValue(card, wildRank) {
    if (isWildJoker(card, wildRank)) return 0;
    return RANK_VALUES[card.rank] || 0;
}

function checkConsecutiveRanks(ranks) {
    const mapRankToIndices = (rank) => {
        if (rank === 'A') return [1, 14];
        const orderIndex = ['2','3','4','5','6','7','8','9','10','J','Q','K'].indexOf(rank);
        return [orderIndex + 2];
    };

    let indexPossification = [[]];
    for (let r of ranks) {
        let idxs = mapRankToIndices(r);
        let newPoss = [];
        for (let p of indexPossification) {
            for (let i of idxs) {
                newPoss.push([...p, i]);
            }
        }
        indexPossification = newPoss;
    }

    for (let arr of indexPossification) {
        arr.sort((a, b) => a - b);
        let isConsecutive = true;
        for (let i = 0; i < arr.length - 1; i++) {
            if (arr[i+1] !== arr[i] + 1) {
                isConsecutive = false;
                break;
            }
        }
        if (isConsecutive) return true;
    }
    return false;
}

export function isPureSequence(cards, wildRank) {
    if (!cards || cards.length < 3) return false;
    if (cards.some(c => c.suit === 'JOKER' || c.rank === 'JOKER')) return false;

    const suit = cards[0].suit;
    if (!cards.every(c => c.suit === suit)) return false;

    const ranks = cards.map(c => c.rank);
    return checkConsecutiveRanks(ranks);
}

function checkConsecutiveWithJokers(ranks, jokerCount) {
    if (ranks.length <= 1) return true;

    const getNumeric = (r, aceHigh = false) => {
        if (r === 'A') return aceHigh ? 14 : 1;
        return ['2','3','4','5','6','7','8','9','10','J','Q','K'].indexOf(r) + 2;
    };

    for (let aceHigh of [false, true]) {
        let nums = ranks.map(r => getNumeric(r, aceHigh)).sort((a,b) => a - b);
        let hasDup = false;
        for(let i=0; i<nums.length-1; i++) {
            if (nums[i] === nums[i+1]) hasDup = true;
        }
        if (hasDup) continue;

        let neededJokers = 0;
        for (let i=0; i<nums.length-1; i++) {
            neededJokers += (nums[i+1] - nums[i] - 1);
        }

        if (neededJokers <= jokerCount) return true;
    }

    return false;
}

export function isImpureSequence(cards, wildRank) {
    if (!cards || cards.length < 3) return false;

    let naturalCards = cards.filter(c => !isWildJoker(c, wildRank));
    let jokerCount = cards.length - naturalCards.length;

    if (naturalCards.length === 0) return true;

    const suit = naturalCards[0].suit;
    if (!naturalCards.every(c => c.suit === suit)) return false;

    const ranks = naturalCards.map(c => c.rank);
    return checkConsecutiveWithJokers(ranks, jokerCount);
}

export function isNaturalSet(cards) {
    if (!cards || cards.length < 3 || cards.length > 4) return false;
    if (cards.some(c => c.suit === 'JOKER' || c.rank === 'JOKER')) return false;

    const firstRank = cards[0].rank;
    if (!cards.every(c => c.rank === firstRank)) return false;

    const suits = cards.map(c => c.suit);
    const uniqueSuits = new Set(suits);
    if (uniqueSuits.size !== cards.length) return false;

    return true;
}

export function isSet(cards, wildRank) {
    if (!cards || cards.length < 3 || cards.length > 4) return false;
    if (isNaturalSet(cards)) return true;

    let naturalCards = cards.filter(c => !isWildJoker(c, wildRank));
    if (naturalCards.length === 0) return true;

    const rank = naturalCards[0].rank;
    if (!naturalCards.every(c => c.rank === rank)) return false;

    const suits = naturalCards.map(c => c.suit);
    const uniqueSuits = new Set(suits);
    if (uniqueSuits.size !== suits.length) return false;

    return true;
}

export function isAllTriplets(groups) {
    if (!groups || groups.length === 0) return false;
    let totalCards = groups.reduce((acc, g) => acc + g.length, 0);
    if (totalCards !== 13) return false;

    return groups.every(g => isNaturalSet(g));
}

export function validateDeclaration(groups, wildRank) {
    if (!groups || groups.length === 0) {
        return { valid: false, isAllTriplets: false, reason: "No card groups formed." };
    }

    let totalCards = groups.reduce((acc, g) => acc + g.length, 0);
    if (totalCards !== 13) {
        return { valid: false, isAllTriplets: false, reason: `Declaration requires exactly 13 cards. Found ${totalCards}.` };
    }

    if (isAllTriplets(groups)) {
        return {
            valid: true,
            isAllTriplets: true,
            reason: "🌟 Special Hand: All Triplets! (Double Win & 2x Points)"
        };
    }

    let pureSeqCount = 0;
    let totalSeqCount = 0;
    let invalidGroups = 0;

    groups.forEach((group) => {
        let isPure = isPureSequence(group, wildRank);
        let isImpure = isImpureSequence(group, wildRank);
        let isAset = isSet(group, wildRank);

        if (isPure) {
            pureSeqCount++;
            totalSeqCount++;
        } else if (isImpure) {
            totalSeqCount++;
        } else if (isAset) {
            // valid set
        } else {
            invalidGroups++;
        }
    });

    if (pureSeqCount < 1) {
        return { valid: false, isAllTriplets: false, reason: "Must have at least 1 Pure Sequence (no Jokers)." };
    }

    if (totalSeqCount < 2) {
        return { valid: false, isAllTriplets: false, reason: "Must have at least 2 Sequences (1 Pure + 1 Impure/Pure)." };
    }

    if (invalidGroups > 0) {
        return { valid: false, isAllTriplets: false, reason: "Some groups are not valid Sequences or Sets." };
    }

    return { valid: true, isAllTriplets: false, reason: "Valid Declaration! Congratulations!" };
}

export function calculateHandPoints(groups, wildRank) {
    const validation = validateDeclaration(groups, wildRank);
    if (validation.valid) return 0;

    let totalPoints = 0;
    groups.forEach(group => {
        let isPure = isPureSequence(group, wildRank);
        let isImpure = isImpureSequence(group, wildRank);
        let isAset = isSet(group, wildRank);

        if (!isPure && !isImpure && !isAset) {
            group.forEach(card => {
                totalPoints += getCardValue(card, wildRank);
            });
        }
    });

    return Math.min(totalPoints, 80);
}
