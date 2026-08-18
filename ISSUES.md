# Issue #1: Missing Features & Layout Sync in Browser Lobby vs Android APK

## 📌 Issue Description
**Title**: Browser Lobby missing features present in Android APK / Legacy app (Tournament #9999 registration, Leaderboard stats, Claim coins bonus, APK banner, Host delete room).

### 🐛 Bug Details & Root Cause
During the React.js + PixiJS migration, the new `LobbyScreen.jsx` rendered a simplified list of custom rooms without accounting for:
1. **Tournament Room #9999 Workflow**: Tournament registration (`register_tournament`/`unregister_tournament`) buttons and player participation logic were omitted.
2. **Claim Free Coins Bonus**: Low coin balance (< 50 coins) refill prompt was omitted.
3. **Leaderboard & Player Stats Modal**: Viewing global player rankings (wins, losses, coin leaderboards via `list_player_stats`) was missing.
4. **Android APK Install Banner**: APK download prompt banner for mobile web users was missing.
5. **Host Room Management**: Room host delete action (`delete_room`) was missing on custom room cards.
6. **Toast Notifications**: Non-blocking toast notifications for user actions were absent.

### 🛠️ Resolution Plan
1. Update `src/services/multiplayer-service.js` to ensure tournament registration APIs (`registerTournamentPlayer`, `unregisterTournamentPlayer`, `listPlayerStats`) are fully connected.
2. Update `src/store/useGameStore.js` and `src/store/useAuthStore.js` to support claim bonus coins and leaderboard state.
3. Create `<LeaderboardModal />` component to display player win/loss rankings.
4. Update `src/components/lobby/LobbyScreen.jsx` to render:
   - Gold-themed Tournament Room `#9999` with Register/Unregister & Join controls.
   - Host `Delete` button on custom rooms created by current user.
   - APK Download Banner (when viewing in Web browser).
   - Animated `🎁 Claim +100 Coins` button when user balance is low.
   - Leaderboard button opening `<LeaderboardModal />`.
