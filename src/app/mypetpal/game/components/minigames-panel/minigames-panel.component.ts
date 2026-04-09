import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../../../shared/shared.module';

@Component({
  selector: 'app-minigames-panel',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './minigames-panel.component.html',
  styleUrls: ['./minigames-panel.component.scss']
})
export class MinigamesPanelComponent {
  @Input() isVisiting = false;
  @Output() launchMinigame = new EventEmitter<string>();

  @Input() isCollapsed = true;

  public onLaunch(game: string): void {
    if (this.isVisiting) return;
    this.launchMinigame.emit(game);
  }
}
