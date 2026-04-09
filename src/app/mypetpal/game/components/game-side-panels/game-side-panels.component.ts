import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DecorPanelComponent } from '../../../feature/decor-panel/decor-panel.component';
import { SocialPanelComponent } from '../../../feature/social-panel/social-panel.component';
import { MinigamesPanelComponent } from '../minigames-panel/minigames-panel.component';
import { LeftPanelTabsComponent, LeftPanelId } from '../left-panel-tabs/left-panel-tabs.component';

@Component({
  selector: 'app-game-side-panels',
  standalone: true,
  imports: [
    CommonModule, 
    DecorPanelComponent, 
    SocialPanelComponent, 
    MinigamesPanelComponent,
    LeftPanelTabsComponent
  ],
  templateUrl: './game-side-panels.component.html',
  styleUrls: ['./game-side-panels.component.scss']
})
export class GameSidePanelsComponent {
  @ViewChild('decorPanel') private decorPanel?: DecorPanelComponent;
  @ViewChild('socialPanel') private socialPanel?: SocialPanelComponent;

  @Input() isVisiting = false;
  @Input() isHomeViewMode = false;
  @Input() isHosting = false;
  @Input() visitingUsername = '';
  @Input() hostingCount = 0;
  @Input() currentVisitorIds: number[] = [];

  @Output() returnHome = new EventEmitter<void>();
  @Output() launchMinigame = new EventEmitter<string>();

  public activeSidePanel: LeftPanelId | null = null;
  public isManuallyCollapsed = false;

  public onPanelCollapseRequest(collapsed: boolean): void {
    this.isManuallyCollapsed = collapsed;
  }

  public onSideTabClick(panelId: LeftPanelId): void {
    if (this.activeSidePanel === panelId) {
      this.activeSidePanel = null;
    } else {
      this.openPanel(panelId);
    }
  }

  // Helper methods for tutorials and external component state manipulation
  public collapseDecorIfExpanded(): void {
    if (this.activeSidePanel === 'decor') {
      this.activeSidePanel = null;
    }
  }

  public collapseSocialIfExpanded(): void {
    if (this.activeSidePanel === 'neighborhood') {
      this.activeSidePanel = null;
    }
  }

  public expandDecorPanel(): void {
    this.activeSidePanel = 'decor';
  }

  public expandSocialPanel(): void {
    this.activeSidePanel = 'neighborhood';
  }

  public openPanel(panelId: LeftPanelId): void {
    if (panelId === 'neighborhood') {
      this.socialPanel?.expandPanel();
      return;
    }

    this.activeSidePanel = panelId;
    if (panelId === 'decor' || panelId === 'leaderboard') {
      const mode = panelId === 'decor' ? 'decor' : 'leaderboard';
      this.decorPanel?.setPanelMode(mode);
    }
  }

  public closeAllPanels(): void {
    this.activeSidePanel = null;
    if (this.socialPanel && !this.socialPanel.isCollapsed) {
      this.socialPanel.toggleCollapse();
    }
  }

  public onReturnHome(): void {
    this.returnHome.emit();
  }

  public onLaunchMinigame(game: string): void {
    this.launchMinigame.emit(game);
  }
}
