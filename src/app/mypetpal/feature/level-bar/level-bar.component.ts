import { Component, HostListener, Input } from '@angular/core';

@Component({
  selector: 'app-level-bar',
  standalone: false,
  templateUrl: './level-bar.component.html',
  styleUrls: ['./level-bar.component.scss']
})
export class LevelBarComponent {
  @Input() level = 0;
  @Input() currentLevelExp = 0;
  @Input() expForNextLevel = 10;
  @Input() expProgressPercent = 0;

  public isExpInfoOpen = false;

  public toggleExpInfoBanner(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isExpInfoOpen = !this.isExpInfoOpen;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.exp-info-wrapper')) {
      this.isExpInfoOpen = false;
    }
  }
}
