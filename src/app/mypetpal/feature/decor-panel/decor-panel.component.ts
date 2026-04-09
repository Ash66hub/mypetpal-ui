import { Component, OnInit, Input, DoCheck, OnDestroy, HostListener } from '@angular/core';
import { DecorService, DecorItem } from '../../../core/decor/decor.service';
import { LeaderboardPanelComponent } from '../leaderboard-panel/leaderboard-panel.component';
import { SharedModule } from '../../../shared/shared.module';

@Component({
  selector: 'app-decor-panel',
  templateUrl: './decor-panel.component.html',
  styleUrls: ['./decor-panel.component.scss'],
  standalone: true,
  imports: [SharedModule, LeaderboardPanelComponent]
})
export class DecorPanelComponent implements OnInit, DoCheck, OnDestroy {
  @Input() isCollapsed: boolean = true;
  @Input() activePanel: 'decor' | 'leaderboard' = 'decor';
  public activeCategory: 'furniture' | 'plant' | 'wall' = 'furniture';
  public filteredItems: DecorItem[] = [];
  public touchDraggingItemId: string | null = null;
  public touchGhostX = 0;
  public touchGhostY = 0;
  public touchGhostCanDrop = false;
  public touchGhostIsValid = true;
  private transparentDragImage: HTMLImageElement | null = null;
  private lastKnownUserLevel: number = -1;
  private touchDraggingItem: DecorItem | null = null;
  private pendingTouchItem: DecorItem | null = null;
  private activeTouchIdentifier: number | null = null;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private isLongTouchDragging = false;
  private activeMouseHold = false;
  private pendingClientX = 0;
  private pendingClientY = 0;
  private readonly longPressDurationMs = 260;
  private shouldRestoreAfterMobileDrag = false;

  @Input() isVisiting: boolean = false;

  constructor(public decorService: DecorService) {
    if (typeof document !== 'undefined') {
      this.transparentDragImage = new Image();
      this.transparentDragImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    }
  }

  ngOnInit(): void {
    this.updateFilteredItems();
    this.lastKnownUserLevel = this.decorService.userLevel();
  }

  ngDoCheck(): void {
    const currentLevel = this.decorService.userLevel();
    if (currentLevel !== this.lastKnownUserLevel) {
      this.lastKnownUserLevel = currentLevel;
      this.updateFilteredItems();
    }
  }

  ngOnDestroy(): void {
    this.clearLongPressTimer();
  }

  @HostListener('window:decor-drag-validation', ['$event'])
  public onDragValidation(event: Event): void {
    const customEvent = event as CustomEvent<{ isValid: boolean }>;
    this.touchGhostIsValid = customEvent.detail.isValid;
  }

  public setPanelMode(mode: 'decor' | 'leaderboard'): void {
    this.activePanel = mode;
  }

  public setCategory(category: 'furniture' | 'plant' | 'wall'): void {
    this.activeCategory = category;
    this.updateFilteredItems();
  }

  private updateFilteredItems(): void {
    this.filteredItems = this.decorService
      .getItemsByCategory(this.activeCategory)
      .slice()
      .sort((a, b) => {
        const lockDelta = Number(this.isLocked(a)) - Number(this.isLocked(b));
        if (lockDelta !== 0) {
          return lockDelta;
        }

        if (a.levelRequired !== b.levelRequired) {
          return a.levelRequired - b.levelRequired;
        }

        return a.name.localeCompare(b.name);
      });
  }

  public isLocked(item: DecorItem): boolean {
    return this.decorService.isItemLocked(item);
  }

  public onDragStart(event: DragEvent, item: DecorItem): void {
    if (this.isLocked(item)) {
      event.preventDefault();
      return;
    }

    if (this.activeMouseHold) {
      event.preventDefault();
      return;
    }

    if (event.dataTransfer) {
      event.dataTransfer.setData('decorItem', JSON.stringify(item));
      event.dataTransfer.effectAllowed = 'copy';

      if (this.transparentDragImage) {
        event.dataTransfer.setDragImage(this.transparentDragImage, 0, 0);
      }
    }

    this.touchDraggingItem = item;
    this.updateTouchGhostFromPoint(event.clientX, event.clientY);
    window.dispatchEvent(new CustomEvent('decor-html5-drag-start', { detail: { item } }));
    this.collapsePanelForMobileDrag();
  }

  public onDrag(event: DragEvent): void {
    if (!this.touchDraggingItem) return;
    if (event.clientX === 0 && event.clientY === 0) return; // Ignore final drag tick before drop
    this.updateTouchGhostFromPoint(event.clientX, event.clientY);
  }

  @HostListener('window:dragend')
  public onDragEnd(): void {
    this.touchDraggingItem = null;
    window.dispatchEvent(new CustomEvent('decor-html5-drag-end'));
    this.restorePanelAfterMobileDrag();
  }

  public onTouchDragStart(event: TouchEvent, item: DecorItem): void {
    if (this.isLocked(item)) {
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }

    this.pendingTouchItem = item;
    this.activeTouchIdentifier = touch.identifier;
    this.pendingClientX = touch.clientX;
    this.pendingClientY = touch.clientY;
    this.isLongTouchDragging = false;
    this.clearLongPressTimer();

    this.longPressTimer = setTimeout(() => {
      if (
        !this.pendingTouchItem ||
        this.activeTouchIdentifier !== touch.identifier
      ) {
        return;
      }

      this.touchDraggingItem = this.pendingTouchItem;
      this.touchDraggingItemId = this.pendingTouchItem.id;
      this.isLongTouchDragging = true;
      this.updateTouchGhostFromPoint(this.pendingClientX, this.pendingClientY);
      this.collapsePanelForMobileDrag();
    }, this.longPressDurationMs);
  }

  public onTouchDragMove(event: TouchEvent): void {
    const touch = this.findMatchingTouch(event.touches);
    if (!touch) {
      return;
    }

    this.pendingClientX = touch.clientX;
    this.pendingClientY = touch.clientY;

    if (!this.isLongTouchDragging || !this.touchDraggingItem) {
      return;
    }

    this.updateTouchGhostFromPoint(touch.clientX, touch.clientY);

    this.dispatchDragMoveEvent(this.touchDraggingItem, touch.clientX, touch.clientY);

    event.preventDefault();
  }

  public onTouchDragEnd(event: TouchEvent): void {
    this.clearLongPressTimer();

    if (!this.isLongTouchDragging || !this.touchDraggingItem) {
      this.clearTouchDragState();
      return;
    }

    const touch = this.findMatchingTouch(event.changedTouches);
    if (!touch) {
      this.clearTouchDragState();
      return;
    }

    this.emitDropIfInsideGame(
      this.touchDraggingItem,
      touch.clientX,
      touch.clientY
    );

    window.dispatchEvent(new CustomEvent('decor-drag-end'));
    this.clearTouchDragState();
    event.preventDefault();
  }

  public onMouseHoldStart(event: MouseEvent, item: DecorItem): void {
    if (this.isLocked(item) || event.button !== 0) {
      return;
    }

    event.preventDefault();

    this.pendingTouchItem = item;
    this.activeTouchIdentifier = null;
    this.activeMouseHold = true;
    this.pendingClientX = event.clientX;
    this.pendingClientY = event.clientY;
    this.isLongTouchDragging = false;
    this.clearLongPressTimer();

    this.longPressTimer = setTimeout(() => {
      if (!this.pendingTouchItem || !this.activeMouseHold) {
        return;
      }

      this.touchDraggingItem = this.pendingTouchItem;
      this.touchDraggingItemId = this.pendingTouchItem.id;
      this.isLongTouchDragging = true;
      this.updateTouchGhostFromPoint(this.pendingClientX, this.pendingClientY);
    }, this.longPressDurationMs);
  }

  public onTouchDragCancel(): void {
    this.clearLongPressTimer();
    this.clearTouchDragState();
  }

  private findMatchingTouch(touches: TouchList): Touch | null {
    if (this.activeTouchIdentifier === null) {
      return touches[0] ?? null;
    }

    for (let i = 0; i < touches.length; i += 1) {
      const touch = touches.item(i);
      if (touch && touch.identifier === this.activeTouchIdentifier) {
        return touch;
      }
    }

    return null;
  }

  private clearTouchDragState(): void {
    this.touchDraggingItem = null;
    this.pendingTouchItem = null;
    this.activeTouchIdentifier = null;
    this.touchDraggingItemId = null;
    this.touchGhostCanDrop = false;
    this.isLongTouchDragging = false;
    this.activeMouseHold = false;
    this.restorePanelAfterMobileDrag();
  }

  private collapsePanelForMobileDrag(): void {
    if (!this.isMobileViewport() || this.isCollapsed) {
      return;
    }

    this.shouldRestoreAfterMobileDrag = true;
    this.isCollapsed = true;
  }

  private restorePanelAfterMobileDrag(): void {
    if (!this.shouldRestoreAfterMobileDrag) {
      return;
    }

    this.isCollapsed = false;
    this.activePanel = 'decor';
    this.shouldRestoreAfterMobileDrag = false;
  }

  private isMobileViewport(): boolean {
    return (
      window.matchMedia('(pointer: coarse)').matches ||
      window.innerWidth <= 768
    );
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private updateTouchGhostFromPoint(clientX: number, clientY: number): void {
    this.touchGhostX = clientX;
    this.touchGhostY = clientY;

    const gameContainer = document.getElementById('game-container');
    if (!gameContainer) {
      this.touchGhostCanDrop = false;
      return;
    }

    const rect = gameContainer.getBoundingClientRect();
    this.touchGhostCanDrop =
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom;
  }

  private dispatchDragMoveEvent(item: DecorItem | null, clientX: number, clientY: number): void {
    if (!item) return;

    window.dispatchEvent(new CustomEvent('decor-drag-move', {
      detail: { item, clientX, clientY }
    }));
  }

  public get touchGhostItem(): DecorItem | null {
    return this.touchDraggingItem;
  }

  private emitDropIfInsideGame(
    item: DecorItem,
    clientX: number,
    clientY: number
  ): void {
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer) {
      return;
    }

    const rect = gameContainer.getBoundingClientRect();
    const isInsideGame =
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom;

    if (!isInsideGame) {
      return;
    }

    window.dispatchEvent(
      new CustomEvent('decor-touch-drop', {
        detail: {
          item,
          clientX,
          clientY
        }
      })
    );
  }

  public getRemaining(item: DecorItem): number {
    const counts = this.decorService.activeCounts();
    const limit = this.decorService.getLimitForItem(item);
    return Math.max(0, limit - (counts[item.id] || 0));
  }
}
