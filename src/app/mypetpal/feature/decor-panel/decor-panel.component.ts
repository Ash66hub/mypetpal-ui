import { Component, OnInit, Input, DoCheck } from '@angular/core';
import { DecorService, DecorItem } from '../../../core/decor/decor.service';
import { SharedModule } from '../../../shared/shared.module';

@Component({
  selector: 'app-decor-panel',
  templateUrl: './decor-panel.component.html',
  styleUrls: ['./decor-panel.component.scss'],
  standalone: true,
  imports: [SharedModule]
})
export class DecorPanelComponent implements OnInit, DoCheck {
  public isCollapsed: boolean = true;
  public activeCategory: 'furniture' | 'plant' | 'wall' = 'furniture';
  public filteredItems: DecorItem[] = [];
  private lastKnownUserLevel: number = -1;

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

  public togglePanel(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  public setCategory(category: 'furniture' | 'plant' | 'wall'): void {
    this.activeCategory = category;
    this.updateFilteredItems();
  }

  private updateFilteredItems(): void {
    this.filteredItems = this.decorService.getItemsByCategory(
      this.activeCategory
    ).slice().sort((a, b) => {
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

    if (event.dataTransfer) {
      event.dataTransfer.setData('decorItem', JSON.stringify(item));
      event.dataTransfer.effectAllowed = 'copy';

      // Optional: Set drag image if needed, but default is usually fine
    }
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
