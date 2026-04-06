import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SharedModule } from '../../../../shared/shared.module';

@Component({
  selector: 'app-game-hud',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './game-hud.component.html',
  styleUrls: ['./game-hud.component.scss']
})
export class GameHudComponent {
  @Input() isGameLoading = true;
  @Input() isSavingRoom = false;
  @Input() toastMessage: string | null = null;
  @Input() isVisiting = false;
  @Input() visitingUsername = '';

  @Output() zoomIn = new EventEmitter<void>();
  @Output() zoomOut = new EventEmitter<void>();

  public onZoomIn(): void {
    this.zoomIn.emit();
  }

  public onZoomOut(): void {
    this.zoomOut.emit();
  }
}
