import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { DecorPanelComponent } from '../../../feature/decor-panel/decor-panel.component';
import { SocialPanelComponent } from '../../../feature/social-panel/social-panel.component';

@Component({
  selector: 'app-game-side-panels',
  standalone: true,
  imports: [DecorPanelComponent, SocialPanelComponent],
  templateUrl: './game-side-panels.component.html'
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

  public onReturnHome(): void {
    this.returnHome.emit();
  }

  public collapseDecorIfExpanded(): void {
    if (this.decorPanel && !this.decorPanel.isCollapsed) {
      this.decorPanel.togglePanel();
    }
  }

  public collapseSocialIfExpanded(): void {
    if (this.socialPanel && !this.socialPanel.isCollapsed) {
      this.socialPanel.toggleCollapse();
    }
  }

  public expandDecorPanel(): void {
    this.decorPanel?.expandPanel();
  }

  public expandSocialPanel(): void {
    this.socialPanel?.expandPanel();
  }
}
