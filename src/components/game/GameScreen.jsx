import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useAuthStore } from '../../store/useAuthStore';
import { GameHeader } from './GameHeader';
import { OpponentsSidebar } from './OpponentsSidebar';
import { DeclarationModal } from './DeclarationModal';
import { PixiApp } from '../../engine/PixiApp';
import { drawCard, discardCard, declareGame, subscribeRoomUpdate, subscribeGameDeclared, startNewGame } from '../../services/multiplayer-service';
import { validateDeclaration } from '../../services/rules';

export function GameScreen() {
    const canvasContainerRef = useRef(null);
    const pixiAppRef = useRef(null);

    const roomState = useGameStore((state) => state.roomState);
    const setRoomState = useGameStore((state) => state.setRoomState);
    const user = useAuthStore((state) => state.user);
    const setDeclarationResult = useGameStore((state) => state.setDeclarationResult);
    const declarationResult = useGameStore((state) => state.declarationResult);

    useEffect(() => {
        if (!canvasContainerRef.current) return;

        pixiAppRef.current = new PixiApp(canvasContainerRef.current, {
            onDrawDeck: () => {
                if (roomState && user && roomState.currentTurnUserId === user.id) {
                    drawCard(roomState.code, user.id, false);
                }
            },
            onDiscardClick: () => {
                if (roomState && user && roomState.currentTurnUserId === user.id) {
                    drawCard(roomState.code, user.id, true);
                }
            },
            onSelectionChange: (selectedCards) => {
                // selection state handled inside PixiApp HandManager
            }
        });

        const unsubUpdate = subscribeRoomUpdate((newRoomState) => {
            setRoomState(newRoomState);
            if (pixiAppRef.current && user) {
                pixiAppRef.current.updateGameState(newRoomState, user.id);
            }
        });

        const unsubDeclared = subscribeGameDeclared((declaration) => {
            setDeclarationResult(declaration);
        });

        if (roomState && user && pixiAppRef.current) {
            pixiAppRef.current.updateGameState(roomState, user.id);
        }

        return () => {
            unsubUpdate();
            unsubDeclared();
            if (pixiAppRef.current) {
                pixiAppRef.current.destroy();
            }
        };
    }, []);

    useEffect(() => {
        if (pixiAppRef.current && roomState && user) {
            pixiAppRef.current.updateGameState(roomState, user.id);
        }
    }, [roomState, user]);

    const handleSort = () => {
        if (pixiAppRef.current && pixiAppRef.current.handManager) {
            // Auto sort trigger
        }
    };

    const handleGroup = () => {
        if (pixiAppRef.current && pixiAppRef.current.handManager) {
            pixiAppRef.current.handManager.groupSelectedCards();
        }
    };

    const handleDeclare = async () => {
        if (!roomState || !user) return;
        const player = roomState.players.find(p => p.id === user.id);
        if (!player || !player.hand) return;

        const validation = validateDeclaration(player.handGroups || [player.hand], roomState.wildJokerRank);
        await declareGame(roomState.code, user.id, {
            isValid: validation.valid,
            reason: validation.reason,
            groups: player.handGroups || [player.hand]
        });
    };

    const handleConfirmRestart = async () => {
        setDeclarationResult(null);
        if (roomState) {
            await startNewGame(roomState.code);
        }
    };

    const isMyTurn = roomState && user && roomState.currentTurnUserId === user.id;

    return (
        <div className="w-full h-full flex flex-col p-0 overflow-hidden bg-[#091a12]">
            <GameHeader />

            <div className="flex-1 w-full flex flex-row items-stretch justify-between min-h-0 overflow-hidden relative">
                <OpponentsSidebar />

                {/* PixiJS WebGL Canvas Container */}
                <div className="flex-1 w-full h-full relative" ref={canvasContainerRef}>
                    {/* Floating Action Bar */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-black/60 p-2 rounded-xl backdrop-blur-md border border-white/10">
                        <button
                            onClick={handleGroup}
                            className="py-2 px-4 bg-blue-700 hover:bg-blue-600 text-white font-bold rounded-lg shadow text-xs sm:text-sm transition active:scale-95"
                        >
                            📦 Group
                        </button>
                        <button
                            onClick={handleSort}
                            className="py-2 px-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg shadow text-xs sm:text-sm transition active:scale-95"
                        >
                            ⚡ Sort
                        </button>
                        {isMyTurn && (
                            <button
                                onClick={handleDeclare}
                                className="py-2 px-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg shadow text-xs sm:text-sm transition active:scale-95 animate-pulse"
                            >
                                🎯 Declare
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {declarationResult && (
                <DeclarationModal onConfirmRestart={handleConfirmRestart} />
            )}
        </div>
    );
}
