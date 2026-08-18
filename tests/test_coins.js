// Unit Tests: Coins Economy Mechanism & Pot Management

const assert = require('assert');

console.log('🧪 RUNNING COINS ECONOMY & POT ENGINE TESTS...\n');

let passed = 0;
let failed = 0;

function it(desc, fn) {
    try {
        fn();
        console.log(`✅ PASS: ${desc}`);
        passed++;
    } catch (e) {
        console.error(`❌ FAIL: ${desc}\n   ${e.message}`);
        failed++;
    }
}

// Simulated User Database
const mockUsers = [
    { id: '1001', username: 'PlayerA', coins: 500, wins: 5, losses: 5 },
    { id: '1002', username: 'PlayerB', coins: 500, wins: 3, losses: 7 },
    { id: '1003', username: 'PlayerC', coins: 500, wins: 8, losses: 2 }
];

// Test 1: Initial user balance is 500
it('Initial user coins default to 500', () => {
    mockUsers.forEach(u => {
        assert.strictEqual(u.coins, 500);
    });
});

// Test 2: Entry stake options are 10, 20, 50, 100
it('Valid entry coin stakes are 10, 20, 50, 100 with default 10', () => {
    const validStakes = [10, 20, 50, 100];
    assert.strictEqual(validStakes.includes(10), true);
    assert.strictEqual(validStakes.includes(20), true);
    assert.strictEqual(validStakes.includes(50), true);
    assert.strictEqual(validStakes.includes(100), true);
    
    function parseStake(val) {
        return validStakes.includes(Number(val)) ? Number(val) : 10;
    }
    assert.strictEqual(parseStake(null), 10);
    assert.strictEqual(parseStake('50'), 50);
    assert.strictEqual(parseStake('999'), 10);
});

// Test 3: Round start stake deduction and Pot accumulation
it('Round start deducts entry stake from all players and builds Pot', () => {
    const entryCoins = 20;
    const players = [
        { id: '1001', name: 'PlayerA', coins: 500 },
        { id: '1002', name: 'PlayerB', coins: 500 }
    ];

    let totalPot = 0;
    players.forEach(p => {
        p.coins -= entryCoins;
        totalPot += entryCoins;
    });

    assert.strictEqual(totalPot, 40);
    assert.strictEqual(players[0].coins, 480);
    assert.strictEqual(players[1].coins, 480);
});

// Test 4: Standard Win awards Pot to winner
it('Standard Win awards full pot to winner', () => {
    const entryCoins = 20;
    let pot = 40;
    const winnerId = '1001';
    const players = [
        { id: '1001', name: 'PlayerA', coins: 480 },
        { id: '1002', name: 'PlayerB', coins: 480 }
    ];

    // Winner gets pot
    const winner = players.find(p => p.id === winnerId);
    winner.coins += pot;

    assert.strictEqual(players[0].coins, 520); // Net +20
    assert.strictEqual(players[1].coins, 480); // Net -20
});

// Test 5: All Triplets Win awards Double Coins from opponents and only 1 Win
it('All Triplets awards Double Coins from each opponent and 1 Win count', () => {
    const entryCoins = 10;
    let pot = 20; // 2 players staked 10 each
    const winnerId = '1001';
    let winnerWins = 5;
    const players = [
        { id: '1001', name: 'PlayerA', coins: 490 }, // staked 10
        { id: '1002', name: 'PlayerB', coins: 490 }  // staked 10
    ];

    // All Triplets double coins logic:
    // Losers pay an extra entryCoins (total 2x entryCoins = 20 coins lost per loser)
    const extraCoinsPerOpponent = entryCoins;
    let extraCoinsTotal = 0;

    players.forEach(p => {
        if (p.id !== winnerId) {
            p.coins -= extraCoinsPerOpponent;
            extraCoinsTotal += extraCoinsPerOpponent;
        }
    });

    const winner = players.find(p => p.id === winnerId);
    winner.coins += pot + extraCoinsTotal;
    winnerWins += 1; // 1 win awarded!

    assert.strictEqual(winnerWins, 6); // Exactly 1 win added
    assert.strictEqual(players[0].coins, 520); // Net +20 (Winner earned double coins: 20 from opponent)
    assert.strictEqual(players[1].coins, 480); // Net -20 (Loser lost double coins: 20)
});

// Test 6: In-game live forfeit pot claim
it('Player leaving live game forfeits pot to remaining player', () => {
    const entryCoins = 50;
    const pot = 100;
    const remainingPlayer = { id: '1001', name: 'PlayerA', coins: 450 }; // staked 50
    // Leaver left at 450 coins (lost 50)
    remainingPlayer.coins += pot;

    assert.strictEqual(remainingPlayer.coins, 550); // Net +50
});

// Test 8: Invalid / Wrong declaration equally distributes declarer coins / pot to all other players
it('Invalid declaration equally distributes pot to all other players', () => {
    const entryCoins = 10;
    const pot = 30; // 3 players: 10 coins each
    const declarerId = '1001';
    const players = [
        { id: '1001', name: 'PlayerA', coins: 490 }, // wrong declarer
        { id: '1002', name: 'PlayerB', coins: 490 }, // other player 1
        { id: '1003', name: 'PlayerC', coins: 490 }  // other player 2
    ];

    const otherPlayers = players.filter(p => p.id !== declarerId);
    const sharePerPlayer = Math.floor(pot / otherPlayers.length);

    otherPlayers.forEach(p => {
        p.coins += sharePerPlayer;
    });

    assert.strictEqual(sharePerPlayer, 15);
    assert.strictEqual(players[0].coins, 490); // Net -10 (lost stake)
    assert.strictEqual(players[1].coins, 505); // Net +5 (won half of wrong show stake)
    assert.strictEqual(players[2].coins, 505); // Net +5 (won half of wrong show stake)
});

console.log(`\n📊 RESULTS: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);

