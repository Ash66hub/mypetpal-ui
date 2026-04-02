import { Component, Input } from '@angular/core';

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
}
