import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SharedModule } from '../../../../shared/shared.module';

export interface TutorialStepViewModel {
  target: 'welcome' | 'pet' | 'decor' | 'friends';
  title: string;
}

@Component({
  selector: 'app-game-tutorial-overlay',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './game-tutorial-overlay.component.html',
  styleUrls: ['./game-tutorial-overlay.component.scss']
})
export class GameTutorialOverlayComponent {
  @Input() visible = false;
  @Input() tutorialStep: TutorialStepViewModel | null = null;
  @Input() tutorialMessage = '';
  @Input() tutorialSpotStyles: Record<string, Record<string, string>> = {};
  @Input() stepIndex = 0;
  @Input() totalSteps = 0;
  @Input() isLastStep = false;

  @Output() skip = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();

  public onSkip(): void {
    this.skip.emit();
  }

  public onNext(): void {
    this.next.emit();
  }
}
