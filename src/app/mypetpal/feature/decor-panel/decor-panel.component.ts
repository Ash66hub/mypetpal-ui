import {
  Component,
  OnInit,
  Input,
  DoCheck,
  OnDestroy,
  HostListener
} from '@angular/core';
import { DecorService, DecorItem } from '../../../core/decor/decor.service';
import { SharedModule } from '../../../shared/shared.module';

@Component({
  selector: 'app-decor-panel',
  templateUrl: './decor-panel.component.html',
  styleUrls: ['./decor-panel.component.scss'],
  standalone: true,
  imports: [SharedModule]
})
export class DecorPanelComponent implements OnInit, DoCheck, OnDestroy {
  public isCollapsed: boolean = true;
  public activeCategory: 'furniture' | 'plant' | 'wall' = 'furniture';
  public filteredItems: DecorItem[] = [];
  public handleTop = 112;
  public isDraggingHandle = false;
  public touchDraggingItemId: string | null = null;
  public touchGhostX = 0;
  public touchGhostY = 0;
  public touchGhostCanDrop = false;
  private lastKnownUserLevel: number = -1;
  private touchDraggingItem: DecorItem | null = null;
  private pendingTouchItem: DecorItem | null = null;
  private activeTouchIdentifier: number | null = null;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private isLongTouchDragging = false;
  private activeMouseHold = false;
  private pendingClientX = 0;
  private pendingClientY = 0;
  private handleDragPointerId: number | null = null;
  private handleDragStartY = 0;
  private handleStartTop = 112;
  private handleDraggedDistance = 0;
  private suppressNextHandleClick = false;
  private readonly longPressDurationMs = 260;
  private readonly panelTopOffsetPx = 68;
  private readonly handleHeightPx = 56;
  private readonly handleEdgePaddingPx = 12;

  @Input() isVisiting: boolean = false;

  constructor(public decorService: DecorService) {}

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

  public togglePanel(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  public onHandleClick(): void {
    if (this.suppressNextHandleClick) {
      this.suppressNextHandleClick = false;
      return;
    }

    this.togglePanel();
  }

  public onHandleMouseDown(event: MouseEvent): void {
    if (event.button !== 0) {
      return;
    }

    this.beginHandleDrag(event.clientY, null);
    event.preventDefault();
  }

  public onHandleTouchStart(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }

    this.beginHandleDrag(touch.clientY, touch.identifier);
  }

  public expandPanel(): void {
    this.isCollapsed = false;
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

      // Optional: Set drag image if needed, but default is usually fine
    }
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

  @HostListener('document:mousemove', ['$event'])
  public onDocumentMouseMove(event: MouseEvent): void {
    if (this.isDraggingHandle && this.handleDragPointerId === null) {
      this.updateHandleDrag(event.clientY);
      return;
    }

    if (!this.activeMouseHold) {
      return;
    }

    this.pendingClientX = event.clientX;
    this.pendingClientY = event.clientY;

    if (this.isLongTouchDragging && this.touchDraggingItem) {
      this.updateTouchGhostFromPoint(event.clientX, event.clientY);
    }
  }

  @HostListener('document:mouseup', ['$event'])
  public onDocumentMouseUp(event: MouseEvent): void {
    if (this.isDraggingHandle && this.handleDragPointerId === null) {
      this.endHandleDrag();
      return;
    }

    if (!this.activeMouseHold || event.button !== 0) {
      return;
    }

    this.clearLongPressTimer();

    if (this.isLongTouchDragging && this.touchDraggingItem) {
      this.emitDropIfInsideGame(
        this.touchDraggingItem,
        event.clientX,
        event.clientY
      );
    }

    this.activeMouseHold = false;
    this.clearTouchDragState();
  }

  public onTouchDragCancel(): void {
    this.clearLongPressTimer();
    this.clearTouchDragState();
  }

  @HostListener('document:touchmove', ['$event'])
  public onDocumentTouchMove(event: TouchEvent): void {
    if (!this.isDraggingHandle || this.handleDragPointerId === null) {
      return;
    }

    const touch = this.findTouchByIdentifier(
      event.touches,
      this.handleDragPointerId
    );
    if (!touch) {
      return;
    }

    this.updateHandleDrag(touch.clientY);
  }

  @HostListener('document:touchend', ['$event'])
  public onDocumentTouchEnd(event: TouchEvent): void {
    if (!this.isDraggingHandle || this.handleDragPointerId === null) {
      return;
    }

    const touch = this.findTouchByIdentifier(
      event.changedTouches,
      this.handleDragPointerId
    );
    if (!touch) {
      return;
    }

    this.endHandleDrag();
  }

  @HostListener('window:resize')
  public onWindowResize(): void {
    this.handleTop = this.clampHandleTop(this.handleTop);
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

  private findTouchByIdentifier(
    touches: TouchList,
    identifier: number
  ): Touch | null {
    for (let i = 0; i < touches.length; i += 1) {
      const touch = touches.item(i);
      if (touch && touch.identifier === identifier) {
        return touch;
      }
    }

    return null;
  }

  private beginHandleDrag(clientY: number, pointerId: number | null): void {
    this.isDraggingHandle = true;
    this.handleDragPointerId = pointerId;
    this.handleDragStartY = clientY;
    this.handleStartTop = this.handleTop;
    this.handleDraggedDistance = 0;
  }

  private updateHandleDrag(clientY: number): void {
    const deltaY = clientY - this.handleDragStartY;
    const nextTop = this.clampHandleTop(this.handleStartTop + deltaY);
    this.handleTop = nextTop;
    this.handleDraggedDistance = Math.max(
      this.handleDraggedDistance,
      Math.abs(deltaY)
    );
  }

  private endHandleDrag(): void {
    if (this.handleDraggedDistance > 4) {
      this.suppressNextHandleClick = true;
    }

    this.isDraggingHandle = false;
    this.handleDragPointerId = null;
    this.handleDraggedDistance = 0;
  }

  private clampHandleTop(rawTop: number): number {
    const minTop = this.handleEdgePaddingPx;
    const maxTop =
      window.innerHeight -
      this.panelTopOffsetPx -
      this.handleHeightPx -
      this.handleEdgePaddingPx;
    return Math.min(Math.max(rawTop, minTop), Math.max(minTop, maxTop));
  }

  private clearTouchDragState(): void {
    this.touchDraggingItem = null;
    this.pendingTouchItem = null;
    this.activeTouchIdentifier = null;
    this.touchDraggingItemId = null;
    this.touchGhostCanDrop = false;
    this.isLongTouchDragging = false;
    this.activeMouseHold = false;
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
    if (item.category === 'wall') {
      return Math.max(0, 50 - (counts[item.id] || 0));
    } else {
      return Math.max(0, 10 - (counts[item.id] || 0));
    }
  }
}
