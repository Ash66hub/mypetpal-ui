import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SharedModule } from '../../shared.module';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.scss']
})
export class PrivacyPolicyComponent {
  public readonly lastUpdated = 'April 6, 2026';

  constructor(private router: Router) {}

  public goBack(): void {
    this.router.navigate(['/game']);
  }
}
