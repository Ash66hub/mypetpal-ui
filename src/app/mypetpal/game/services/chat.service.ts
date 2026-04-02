import { Injectable } from '@angular/core';
import * as Phaser from 'phaser';

interface ChatBubbleConfig {
  maxWidth?: number;
  charLimit?: number;
  displayDuration?: number;
  fadeOutDuration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private readonly DEFAULT_CONFIG: ChatBubbleConfig = {
    maxWidth: 160,
    charLimit: 100,
    displayDuration: 5000,
    fadeOutDuration: 400
  };

  renderChatBubble(
    text: string,
    anchor: any,
    bubblesArr: Phaser.GameObjects.Container[],
    scene: Phaser.Scene,
    config: ChatBubbleConfig = {}
  ): void {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };

    const filteredText = this.formatText(text, finalConfig.charLimit!);

    const paddingX = 8;
    const paddingY = 4;
    const maxBubbleWidth = finalConfig.maxWidth!;

    bubblesArr.forEach(b => {
      const pointer = b.getByName('pointer');
      if (pointer) (pointer as any).alpha = 0;
    });

    const txt = scene.add
      .text(0, 0, filteredText, {
        fontFamily: "'Quicksand', sans-serif",
        fontStyle: 'bold',
        fontSize: '32px',
        color: '#1a1a2e',
        align: 'center',
        resolution: 4,
        wordWrap: { width: (maxBubbleWidth - paddingX * 2) * 4 }
      })
      .setOrigin(0.5);

    txt.setScale(0.25);
    txt.setAlpha(1.0);

    const bubbleWidth = Math.max(
      40,
      Math.min(txt.width * 0.25 + paddingX * 2, maxBubbleWidth)
    );
    const bubbleHeight = txt.height * 0.25 + paddingY * 2;

    const bg = scene.add.graphics();
    bg.fillStyle(0xffffff, 0.75);
    bg.fillRoundedRect(
      -bubbleWidth / 2,
      -bubbleHeight / 2,
      bubbleWidth,
      bubbleHeight,
      6
    );
    bg.lineStyle(1.0, 0xffffff, 0.9);
    bg.strokeRoundedRect(
      -bubbleWidth / 2,
      -bubbleHeight / 2,
      bubbleWidth,
      bubbleHeight,
      6
    );

    const pointer = scene.add.graphics();
    pointer.setName('pointer');
    const pointerSize = 4;
    pointer.fillStyle(0xffffff, 0.75);
    pointer.beginPath();
    pointer.moveTo(-pointerSize, bubbleHeight / 2 - 1);
    pointer.lineTo(0, bubbleHeight / 2 + pointerSize);
    pointer.lineTo(pointerSize, bubbleHeight / 2 - 1);
    pointer.closePath();
    pointer.fillPath();

    pointer.lineStyle(1.0, 0xffffff, 0.9);
    pointer.beginPath();
    pointer.moveTo(-pointerSize, bubbleHeight / 2 - 1);
    pointer.lineTo(0, bubbleHeight / 2 + pointerSize);
    pointer.lineTo(pointerSize, bubbleHeight / 2 - 1);
    pointer.strokePath();

    const container = scene.add.container(anchor.x, anchor.y - 28, [
      pointer,
      bg,
      txt
    ]);
    container.setDepth(20);
    container.setAlpha(0);
    (container as any).originalHeight = bubbleHeight;
    (container as any).anchorRef = anchor;

    scene.tweens.add({
      targets: container,
      alpha: 1,
      duration: 200,
      ease: 'Power1'
    });

    bubblesArr.push(container);

    scene.time.delayedCall(finalConfig.displayDuration!, () => {
      scene.tweens.add({
        targets: container,
        alpha: 0,
        y: container.y - 20,
        duration: finalConfig.fadeOutDuration!,
        onComplete: () => {
          const idx = bubblesArr.indexOf(container);
          if (idx !== -1) bubblesArr.splice(idx, 1);
          container.destroy();
        }
      });
    });
  }

  private formatText(text: string, charLimit: number): string {
    let filtered = text.substring(0, charLimit);

    const words = filtered.split(' ');
    filtered = words
      .map(word => {
        if (word.length > 20) {
          return word.match(/.{1,20}/g)?.join(' ') || word;
        }
        return word;
      })
      .join(' ');

    if (text.length > charLimit) filtered += '...';
    return filtered;
  }

  insertEmojiAtCursor(
    inputElement: HTMLInputElement,
    emoji: string,
    maxLength = 100
  ): void {
    const start = inputElement.selectionStart || 0;
    const end = inputElement.selectionEnd || 0;
    const val = inputElement.value;

    if (val.length + emoji.length <= maxLength) {
      inputElement.value = val.substring(0, start) + emoji + val.substring(end);
      inputElement.selectionStart = inputElement.selectionEnd =
        start + emoji.length;
      inputElement.focus();
    }
  }
}
