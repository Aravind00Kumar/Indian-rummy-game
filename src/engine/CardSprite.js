import * as PIXI from 'pixi.js';
import { getCardTexture } from './TextureLoader';

export class CardSprite extends PIXI.Container {
    constructor(cardData = {}, options = {}) {
        super();

        const { suit = 'H', rank = 'A', isJoker = false, faceDown = false, isWild = false } = cardData;
        const { width = 75, height = 105, interactive = true } = options;

        this.cardData = cardData;
        this.cardWidth = width;
        this.cardHeight = height;
        this.isSelected = false;
        this.isDragging = false;
        this.dragData = null;
        this.originalPos = { x: 0, y: 0 };

        // 1. Base Sprite
        this.sprite = new PIXI.Sprite(getCardTexture(suit, rank, isJoker, faceDown));
        this.sprite.width = width;
        this.sprite.height = height;
        this.sprite.anchor.set(0.5);
        this.addChild(this.sprite);

        // 2. Wild Joker Badge overlay if wild
        if (isWild && !faceDown) {
            const badge = new PIXI.Graphics();
            badge.beginFill(0xecc94b);
            badge.drawCircle(width / 2 - 12, -height / 2 + 12, 10);
            badge.endFill();

            const starText = new PIXI.Text('★', {
                fontSize: 12,
                fill: 0x744210,
                fontWeight: 'bold'
            });
            starText.anchor.set(0.5);
            starText.position.set(width / 2 - 12, -height / 2 + 12);

            this.addChild(badge);
            this.addChild(starText);
        }

        // 3. Selection Highlight Ring
        this.highlight = new PIXI.Graphics();
        this.highlight.lineStyle(3, 0xf6ad55);
        this.highlight.drawRoundedRect(-width / 2 - 2, -height / 2 - 2, width + 4, height + 4, 8);
        this.highlight.visible = false;
        this.addChild(this.highlight);

        if (interactive) {
            this.eventMode = 'static';
            this.cursor = 'pointer';
            this.setupInteractions();
        }
    }

    setupInteractions() {
        this.on('pointerdown', this.onPointerDown, this);
        this.on('pointermove', this.onPointerMove, this);
        this.on('pointerup', this.onPointerUp, this);
        this.on('pointerupoutside', this.onPointerUp, this);
    }

    setSelected(selected) {
        this.isSelected = selected;
        this.highlight.visible = selected;
        this.y = selected ? this.originalPos.y - 14 : this.originalPos.y;
    }

    onPointerDown(event) {
        this.isDragging = true;
        this.dragData = event.data;
        this.alpha = 0.85;
        this.scale.set(1.08);
        this.parent.addChild(this); // Bring to front of container
    }

    onPointerMove(event) {
        if (this.isDragging && this.dragData) {
            const newPosition = this.dragData.getLocalPointerPosition(this.parent);
            this.x = newPosition.x;
            this.y = newPosition.y;
        }
    }

    onPointerUp() {
        if (this.isDragging) {
            this.isDragging = false;
            this.dragData = null;
            this.alpha = 1.0;
            this.scale.set(1.0);

            if (this.onDragEndCallback) {
                this.onDragEndCallback(this);
            }
        }
    }

    animateFlip(newFaceDown, callback) {
        let step = 0;
        const totalSteps = 10;
        const interval = setInterval(() => {
            step++;
            const scaleX = Math.cos((step / totalSteps) * Math.PI);
            this.scale.x = Math.abs(scaleX);

            if (step === totalSteps / 2) {
                this.sprite.texture = getCardTexture(this.cardData.suit, this.cardData.rank, this.cardData.isJoker, newFaceDown);
            }

            if (step >= totalSteps) {
                clearInterval(interval);
                this.scale.x = 1.0;
                if (callback) callback();
            }
        }, 16);
    }
}
