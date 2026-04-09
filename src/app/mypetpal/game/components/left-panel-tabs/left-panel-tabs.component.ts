import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type LeftPanelId = 'decor' | 'leaderboard' | 'minigames' | 'neighborhood';

interface PanelTab {
  id: LeftPanelId;
  icon: string;
  title: string;
  colorType: 'decor' | 'leaderboard' | 'minigames' | 'social';
}

@Component({
  selector: 'app-left-panel-tabs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './left-panel-tabs.component.html',
  styleUrls: ['./left-panel-tabs.component.scss']
})
export class LeftPanelTabsComponent {
  @Input() activePanel: LeftPanelId | null = null;
  @Input() showSocial = true;
  @Output() tabClick = new EventEmitter<LeftPanelId>();

  public tabs: PanelTab[] = [
    { id: 'decor', icon: '🔨', title: 'Decorate', colorType: 'decor' },
    { id: 'leaderboard', icon: '🏆', title: 'Leaderboard', colorType: 'leaderboard' },
    { id: 'minigames', icon: '🕹️', title: 'Mini Games', colorType: 'minigames' }
  ];

  public onTabClick(id: LeftPanelId): void {
    this.tabClick.emit(id);
  }
}
