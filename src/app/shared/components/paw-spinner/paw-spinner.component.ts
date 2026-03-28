import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-paw-spinner',
  templateUrl: './paw-spinner.component.html',
  styleUrls: ['./paw-spinner.component.scss'],
  standalone: false
})
export class PawSpinnerComponent {
  @Input() diameter: number = 40;
  @Input() color: string = '#7c3aed';
  @Input() icon: string = '🐾';
}
