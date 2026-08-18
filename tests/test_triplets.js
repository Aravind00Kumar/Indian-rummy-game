const fs = require('fs');
const path = require('path');

const vm = require('vm');
const rulesCode = fs.readFileSync(path.join(__dirname, '../js/rules.js'), 'utf8');
const context = { console };
vm.createContext(context);
vm.runInContext(rulesCode + '; globalThis.RUMMY_RULES = RUMMY_RULES;', context);
const RUMMY_RULES = context.RUMMY_RULES;

console.log('🧪 RUNNING "ALL TRIPLETS" RULES ENGINE TESTS...\n');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, testName) {
    if (condition) {
        console.log(`✅ PASS: ${testName}`);
        testsPassed++;
    } else {
        console.error(`❌ FAIL: ${testName}`);
        testsFailed++;
    }
}

// 1. Natural Triplet Tests
const wildRank = '2';

// 7S, 7H, 7D -> Natural triplet
const set7 = [
    { rank: '7', suit: 'S' },
    { rank: '7', suit: 'H' },
    { rank: '7', suit: 'D' }
];
assert(RUMMY_RULES.isNaturalSet(set7) === true, '7♠ 7♥ 7♦ is a Natural Triplet');

// KS, KH, KD -> Natural triplet
const setK = [
    { rank: 'K', suit: 'S' },
    { rank: 'K', suit: 'H' },
    { rank: 'K', suit: 'D' }
];
assert(RUMMY_RULES.isNaturalSet(setK) === true, 'K♠ K♥ K♦ is a Natural Triplet');

// 2S, 2H, 2D when 2 is wild joker -> Natural triplet (natural rank use!)
const set2 = [
    { rank: '2', suit: 'S' },
    { rank: '2', suit: 'H' },
    { rank: '2', suit: 'D' }
];
assert(RUMMY_RULES.isNaturalSet(set2) === true, '2♠ 2♥ 2♦ (wild rank 2) is a Natural Triplet when used as natural rank');

// 7S, 7H, 2D when 2 is wild joker -> NOT a natural triplet (substitute used)
const set7_with_2 = [
    { rank: '7', suit: 'S' },
    { rank: '7', suit: 'H' },
    { rank: '2', suit: 'D' }
];
assert(RUMMY_RULES.isNaturalSet(set7_with_2) === false, '7♠ 7♥ 2♦ is NOT a Natural Triplet (substitute)');
assert(RUMMY_RULES.isSet(set7_with_2, wildRank) === true, '7♠ 7♥ 2♦ is a normal Joker Set');

// KS, KH, 2D when 2 is wild joker -> NOT a natural triplet (substitute used)
const setK_with_2 = [
    { rank: 'K', suit: 'S' },
    { rank: 'K', suit: 'H' },
    { rank: '2', suit: 'D' }
];
assert(RUMMY_RULES.isNaturalSet(setK_with_2) === false, 'K♠ K♥ 2♦ is NOT a Natural Triplet (substitute)');

// Duplicate suits: 2S, 2S, 2H -> NOT a natural triplet
const set_dup_suits = [
    { rank: '2', suit: 'S' },
    { rank: '2', suit: 'S' },
    { rank: '2', suit: 'H' }
];
assert(RUMMY_RULES.isNaturalSet(set_dup_suits) === false, 'Duplicate suits in set is NOT a Natural Triplet');

// 4-card natural set: AS, AH, AD, AC
const setA4 = [
    { rank: 'A', suit: 'S' },
    { rank: 'A', suit: 'H' },
    { rank: 'A', suit: 'D' },
    { rank: 'A', suit: 'C' }
];
assert(RUMMY_RULES.isNaturalSet(setA4) === true, 'A♠ A♥ A♦ A♣ (4 cards) is a Natural Set');

// 2. Full 13-Card Hand All Triplets Validation
const allTripletsHand = [
    set7,
    setK,
    set2,
    setA4
];
const valResult = RUMMY_RULES.validateDeclaration(allTripletsHand, wildRank);
assert(valResult.valid === true, 'All-Triplets 13-card hand qualifies for valid declaration');
assert(valResult.isAllTriplets === true, 'All-Triplets flag is set to true');

// 3. Hand with 1 sequence and 3 sets (not all triplets)
const seqHand = [
    [ { rank: '3', suit: 'S' }, { rank: '4', suit: 'S' }, { rank: '5', suit: 'S' } ],
    set7,
    setK,
    setA4
];
const valSeqResult = RUMMY_RULES.validateDeclaration(seqHand, wildRank);
assert(valSeqResult.isAllTriplets === false, 'Hand with a sequence is not All Triplets');

// 4. Hand with sets where one uses a Joker substitute
const jokerSetHand = [
    set7_with_2,
    setK,
    set2,
    setA4
];
const valJokerResult = RUMMY_RULES.validateDeclaration(jokerSetHand, wildRank);
assert(valJokerResult.isAllTriplets === false, 'Hand with a Joker substitute is not All Triplets');

console.log(`\n📊 RESULTS: ${testsPassed} passed, ${testsFailed} failed.\n`);
if (testsFailed > 0) process.exit(1);
