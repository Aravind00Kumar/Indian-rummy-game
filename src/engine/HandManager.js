import * as PIXI from 'pixi.js';
import { CardSprite } from './CardSprite';
import { isPureSequence, isImpureSequence, isSet } from '../services/rules';

export class HandManager extends PIXI.Container {
    constructor(options = {}) {
        super();
        this.cardWidth = options.cardWidth || 70;
        this.cardHeight = options.cardHeight || 98;
        this.cards = [];
        this.groups = []; // Array of arrays of CardSprite objects
        this.wildRank = null;
        this.onSelectionChange = options.onSelectionChange || null;
        this.onCardDropped = options.onCardDropped || null;
    }

    setHandCards(cardList, wildRank = null, customGroups = null) {
        this.removeChildren();
        this.cards = [];
        this.groups = [];
        this.wildRank = wildRank;

        let groupsData = customGroups;
        if (!groupsData || groupsData.length === 0) {
            groupsData = [cardList]; // Single group default
        }

        groupsData.forEach((groupCards) => {
            const groupSprites = [];
            groupCards.forEach((c) => {
                const isWild = c.rank === wildRank;
                const cardSprite = new CardSprite(
                    { ...c, isWild },
                    { width: this.cardWidth, height: this.cardHeight, interactive: true }
                );

                cardSprite.onDragEndCallback = (sprite) => this.handleCardDragEnd(sprite);
                cardSprite.on('pointertap', () => this.handleCardTap(cardSprite));

                this.addChild(cardSprite);
                this.cards.push(cardSprite);
                groupSprites.push(cardSprite);
            });
            this.groups.push(groupSprites);
        });

        this.layoutGroups();
    }

    layoutGroups() {
        const totalGroups = this.groups.length;
        if (totalGroups === 0) return;

        const groupSpacing = 24;
        const overlap = 28;
        
        let currentX = 20;
        const startY = 0;

        this.groups.forEach((group, gIdx) => {
            group.forEach((cardSprite, cIdx) => {
                const targetX = currentX + cIdx * overlap;
                const targetY = cardSprite.isSelected ? startY - 14 : startY;

                cardSprite.originalPos = { x: targetX, y: startY };
                cardSprite.position.set(targetX, targetY);
            });

            currentX += group.length * overlap + groupSpacing;
        });
    }

    handleCardTap(cardSprite) {
        cardSprite.setSelected(!cardSprite.isSelected);
        if (this.onSelectionChange) {
            const selectedIndices = this.getSelectedCardData();
            this.onSelectionChange(selectedIndices);
        }
    }

    handleCardDragEnd(draggedSprite) {
        this.layoutGroups();
        if (this.onCardDropped) {
            this.onCardDropped(draggedSprite);
        }
    }

    getSelectedCardData() {
        return this.cards
            .filter(c => c.isSelected)
            .map(c => c.cardData);
    }

    getSelectedSprites() {
        return this.cards.filter(c => c.isSelected);
    }

    groupSelectedCards() {
        const selected = this.getSelectedSprites();
        if (selected.length < 2) return;

        // Remove selected cards from current groups
        this.groups = this.groups.map(group => group.filter(c => !c.isSelected)).filter(group => group.length > 0);
        
        // Add selected cards as a new group
        this.groups.push(selected);
        selected.forEach(c => c.setSelected(false));

        this.layoutGroups();
    }
}
