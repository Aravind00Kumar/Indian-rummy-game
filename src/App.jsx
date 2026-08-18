import React from 'react';
import { useAuthStore } from './store/useAuthStore';
import { useGameStore } from './store/useGameStore';
import { AuthScreen } from './components/auth/AuthScreen';
import { LobbyScreen } from './components/lobby/LobbyScreen';
import { GameScreen } from './components/game/GameScreen';
import { CreateRoomModal } from './components/modals/CreateRoomModal';
import { JoinRoomModal } from './components/modals/JoinRoomModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { LeaderboardModal } from './components/modals/LeaderboardModal';

export function App() {
    const user = useAuthStore((state) => state.user);
    const activeScreen = useGameStore((state) => state.activeScreen);
    const setSettingsModalOpen = useGameStore((state) => state.setSettingsModalOpen);

    // Dynamic View Selection based on User Session & Game State
    let currentView;
    if (!user) {
        currentView = <AuthScreen onOpenSettings={() => setSettingsModalOpen(true)} onOpenAbout={() => {}} />;
    } else if (activeScreen === 'game') {
        currentView = <GameScreen />;
    } else {
        currentView = <LobbyScreen />;
    }

    return (
        <div className="w-full h-full relative overflow-hidden bg-slate-950 font-['Outfit',sans-serif]">
            {currentView}
            <CreateRoomModal />
            <JoinRoomModal />
            <SettingsModal />
            <LeaderboardModal />
        </div>
    );
}

export default App;
