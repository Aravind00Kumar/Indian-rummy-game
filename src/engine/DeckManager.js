import * as PIXI from 'pixi.js';
import { CardSprite } from './CardSprite';

export class DeckManager extends PIXI.Container {
    constructor(options = {}) {
        super();
        this.cardWidth = options.cardWidth || 60;
        this.cardHeight = options.cardHeight || 84;
        
        this.onDrawDeckClick = options.onDrawDeckClick || null;
        this.onDiscardClick = options.onDiscardClick || null;
        this.onDeclareDrop = options.onDeclareDrop || null;

        this.setupSlots();
    }

    setupSlots() {
        const slotWidth = this.cardWidth;
        const slotHeight = this.cardHeight;
        const gap = 40;

        // 1. Declare Slot (Left)
        this.declareSlot = new PIXI.Container();
        const declareBg = new PIXI.Graphics();
        declareBg.lineStyle(2, 0xecc94b, 0.8);
        declareBg.beginFill(0xecc94b, 0.1);
        declareBg.drawRoundedRect(-slotWidth / 2, -slotHeight / 2, slotWidth, slotHeight, 6);
        declareBg.endFill();
        this.declareSlot.addChild(declareBg);

        const declareText = new PIXI.Text('DECLARE', {
            fontSize: 10,
            fill: 0xecc94b,
            fontWeight: 'bold'
        });
        declareText.anchor.set(0.5);
        this.declareSlot.addChild(declareText);
        this.declareSlot.position.set(0, 0);
        this.addChild(this.declareSlot);

        // 2. Closed Draw Deck (Center)
        this.drawDeckSlot = new PIXI.Container();
        this.wildCardSprite = new CardSprite({ faceDown: false }, { width: slotWidth, height: slotHeight, interactive: false });
        this.wildCardSprite.position.set(-15, 0);
        this.drawDeckSlot.addChild(this.wildCardSprite);

        this.closedDeckSprite = new CardSprite({ faceDown: true }, { width: slotWidth, height: slotHeight, interactive: true });
        this.closedDeckSprite.position.set(0, 0);
        this.closedDeckSprite.cursor = 'pointer';
        this.closedDeckSprite.on('pointertap', () => {
            if (this.onDrawDeckClick) this.onDrawDeckClick();
        });
        this.drawDeckSlot.addChild(this.closedDeckSprite);

        this.drawDeckSlot.position.set(slotWidth + gap, 0);
        this.addChild(this.drawDeckSlot);

        // 3. Open Discard Slot (Right)
        this.discardSlot = new PIXI.Container();
        this.discardSlot.position.set((slotWidth + gap) * 2, 0);
        this.addChild(this.discardSlot);
    }

    setWildCard(wildCard) {
        if (!wildCard) return;
        this.drawDeckSlot.removeChild(this.wildCardSprite);
        this.wildCardSprite = new CardSprite({ ...wildCard, isWild: true }, { width: this.cardWidth, height: this.cardHeight, interactive: false });
        this.wildCardSprite.position.set(-15, 0);
        this.drawDeckSlot.addChildAt(this.wildCardSprite, 0);
    }

    setDiscardCard(discardCard) {
        this.discardSlot.removeChildren();
        if (!discardCard) {
            const emptyBg = new PIXI.Graphics();
            emptyBg.lineStyle(1.5, 0xffffff, 0.4);
            emptyBg.drawRoundedRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 6);
            this.discardSlot.addChild(emptyBg);
            return;
        }

        const discardSprite = new CardSprite(discardCard, { width: this.cardWidth, height: this.cardHeight, interactive: true });
        discardSprite.cursor = 'pointer';
        discardSprite.on('pointertap', () => {
            if (this.onDiscardClick) this.onDiscardClick();
        });
        this.discardSlot.addChild(discardSprite);
    }
}
