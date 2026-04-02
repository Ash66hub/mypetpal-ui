import { Component } from '@angular/core';
import { LoginStreamService } from '../../core/login/login-service/login-stream.service';
import { Router } from '@angular/router';
import { FriendService } from '../../core/social/friend.service';

@Component({
    selector: 'app-top-bar',
    templateUrl: './top-bar.component.html',
    styleUrls: ['./top-bar.component.scss'],
    standalone: false
})
export class TopBarComponent {
  constructor(
    private loginStreamService: LoginStreamService,
    private router: Router,
    private friendService: FriendService
  ) {}

  public openProfile() {
    this.router.navigate(['/profile']);
  }

  public logoutUser() {
    this.loginStreamService.logout();

    this.router.navigate(['/login']);
  }
}
