import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  OnInit,
  SimpleChanges
} from '@angular/core';
import { SharedModule } from '../../../../shared/shared.module';

@Component({
  selector: 'app-game-hud',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './game-hud.component.html',
  styleUrls: ['./game-hud.component.scss']
})
export class GameHudComponent implements OnInit, OnChanges {
  @Input() isGameLoading = true;
  @Input() isSavingRoom = false;
  @Input() toastMessage: string | null = null;
  @Input() isVisiting = false;
  @Input() visitingUsername = '';

  @Output() zoomIn = new EventEmitter<void>();
  @Output() zoomOut = new EventEmitter<void>();

  public selectedLoadingTip = '';
  private readonly loadingTips: Array<{ text: string; weight: number }> = [
    {
      text: 'Tip: Turn on in-game music in the profile menu.',
      weight: 5
    },
    {
      text: "Tip: You can see the top players on the leaderboard by opening the 🏆 'trophy' panel.",
      weight: 2
    },
    {
      text: "Tip: View other player's spaces and pet pals by pressing the View button 👁️ in the leaderboard or the neighborhood panel.",
      weight: 2
    },
    {
      text: 'Tip: Visit your Pals to your space and interact with their pet, or get invited to theirs.',
      weight: 2
    },
    {
      text: 'Tip: Build your own Cozy Pet Space by choosing from the available Decor options 🔨.',
      weight: 2
    }
  ];

  ngOnInit(): void {
    if (this.isGameLoading) {
      this.pickLoadingTip();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    const loadingChange = changes['isGameLoading'];
    if (
      loadingChange &&
      loadingChange.currentValue === true &&
      loadingChange.previousValue !== true
    ) {
      this.pickLoadingTip();
    }
  }

  public onZoomIn(): void {
    this.zoomIn.emit();
  }

  public onZoomOut(): void {
    this.zoomOut.emit();
  }

  private pickLoadingTip(): void {
    const totalWeight = this.loadingTips.reduce(
      (sum, tip) => sum + tip.weight,
      0
    );

    let randomValue = Math.random() * totalWeight;

    for (const tip of this.loadingTips) {
      randomValue -= tip.weight;
      if (randomValue <= 0) {
        this.selectedLoadingTip = tip.text;
        return;
      }
    }

    this.selectedLoadingTip = this.loadingTips[0]?.text || '';
  }
}
