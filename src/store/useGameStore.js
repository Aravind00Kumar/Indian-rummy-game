import { create } from 'zustand';

export const useGameStore = create((set, get) => ({
    activeScreen: 'auth', // 'auth' | 'lobby' | 'game'
    roomState: null,
    selectedCardIndices: [],
    cardGroups: [],
    declarationResult: null,
    
    // UI Modals
    isCreateModalOpen: false,
    isJoinModalOpen: false,
    isSettingsModalOpen: false,
    isAboutModalOpen: false,
    isDeclareModalOpen: false,
    isLeaderboardModalOpen: false,

    setActiveScreen: (screen) => set({ activeScreen: screen }),
    setRoomState: (roomState) => set({ roomState }),
    setSelectedCardIndices: (indices) => set({ selectedCardIndices: indices }),
    toggleCardSelection: (index) => {
        const current = get().selectedCardIndices;
        if (current.includes(index)) {
            set({ selectedCardIndices: current.filter(i => i !== index) });
        } else {
            set({ selectedCardIndices: [...current, index] });
        }
    },
    clearCardSelection: () => set({ selectedCardIndices: [] }),
    setCardGroups: (groups) => set({ cardGroups: groups }),
    setDeclarationResult: (result) => set({ declarationResult: result, isDeclareModalOpen: !!result }),

    setCreateModalOpen: (open) => set({ isCreateModalOpen: open }),
    setJoinModalOpen: (open) => set({ isJoinModalOpen: open }),
    setSettingsModalOpen: (open) => set({ isSettingsModalOpen: open }),
    setAboutModalOpen: (open) => set({ isAboutModalOpen: open }),
    setDeclareModalOpen: (open) => set({ isDeclareModalOpen: open }),
    setLeaderboardModalOpen: (open) => set({ isLeaderboardModalOpen: open })
}));
