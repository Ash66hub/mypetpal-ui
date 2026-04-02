import { Component, OnInit, Input } from '@angular/core';
import { DecorService, DecorItem } from '../../../core/decor/decor.service';
import { SharedModule } from '../../../shared/shared.module';

@Component({
  selector: 'app-decor-panel',
  templateUrl: './decor-panel.component.html',
  styleUrls: ['./decor-panel.component.scss'],
  standalone: true,
  imports: [SharedModule]
})
export class DecorPanelComponent implements OnInit {
  public isCollapsed: boolean = true;
  public activeCategory: 'furniture' | 'plant' | 'wall' = 'furniture';
  public filteredItems: DecorItem[] = [];

  @Input() isVisiting: boolean = false;

  constructor(public decorService: DecorService) {}

  ngOnInit(): void {
    this.updateFilteredItems();
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
    );
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
      const allWalls = this.decorService.getItemsByCategory('wall');
      const totalWallsInRoom = allWalls.reduce(
        (sum: number, w: DecorItem) => sum + (counts[w.id] || 0),
        0
      );
      return Math.max(0, 50 - totalWallsInRoom);
    } else {
      return Math.max(0, 10 - (counts[item.id] || 0));
    }
  }
}
