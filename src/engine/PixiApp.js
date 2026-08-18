import * as PIXI from 'pixi.js';
import { HandManager } from './HandManager';
import { DeckManager } from './DeckManager';

export class PixiApp {
    constructor(containerElement, callbacks = {}) {
        this.container = containerElement;
        this.callbacks = callbacks;
        this.app = null;
        this.handManager = null;
        this.deckManager = null;

        this.init();
    }

    init() {
        const width = this.container.clientWidth || 800;
        const height = this.container.clientHeight || 500;

        this.app = new PIXI.Application({
            width,
            height,
            backgroundColor: 0x091a12,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            antialias: true
        });

        this.container.appendChild(this.app.view);

        // Green Felt Table Background Overlay
        const feltBg = new PIXI.Graphics();
        feltBg.beginFill(0x0e4429);
        feltBg.drawRoundedRect(10, 10, width - 20, height - 20, 20);
        feltBg.endFill();
        this.app.stage.addChild(feltBg);

        // Deck Manager (Top center)
        this.deckManager = new DeckManager({
            cardWidth: Math.min(65, width * 0.1),
            cardHeight: Math.min(92, height * 0.22),
            onDrawDeckClick: () => this.callbacks.onDrawDeck && this.callbacks.onDrawDeck(),
            onDiscardClick: () => this.callbacks.onDiscardClick && this.callbacks.onDiscardClick()
        });
        this.deckManager.position.set(width / 2 - 120, 30);
        this.app.stage.addChild(this.deckManager);

        // Hand Manager (Bottom)
        this.handManager = new HandManager({
            cardWidth: Math.min(70, width * 0.11),
            cardHeight: Math.min(98, height * 0.25),
            onSelectionChange: (selected) => this.callbacks.onSelectionChange && this.callbacks.onSelectionChange(selected),
            onCardDropped: (sprite) => this.callbacks.onCardDropped && this.callbacks.onCardDropped(sprite)
        });
        this.handManager.position.set(20, height - 125);
        this.app.stage.addChild(this.handManager);

        // Resize handler
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    handleResize() {
        if (!this.container || !this.app) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.app.renderer.resize(width, height);
    }

    updateGameState(roomState, currentUserId) {
        if (!roomState) return;

        const player = roomState.players ? roomState.players.find(p => p.id === currentUserId) : null;
        if (player && player.hand) {
            this.handManager.setHandCards(player.hand, roomState.wildJokerRank, player.handGroups);
        }

        if (this.deckManager) {
            this.deckManager.setWildCard(roomState.wildJokerCard);
            this.deckManager.setDiscardCard(roomState.discardPile ? roomState.discardPile[roomState.discardPile.length - 1] : null);
        }
    }

    destroy() {
        window.removeEventListener('resize', this.handleResize.bind(this));
        if (this.app) {
            this.app.destroy(true, { children: true });
        }
    }
}
