import { Component, OnDestroy, OnInit } from '@angular/core';
import { LoginStreamService } from '../../core/login/login-service/login-stream.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-top-bar',
  templateUrl: './top-bar.component.html',
  styleUrls: ['./top-bar.component.scss'],
  standalone: false
})
export class TopBarComponent implements OnInit, OnDestroy {
  public avatarLetter: string = 'U';
  private userSub?: Subscription;

  constructor(
    private loginStreamService: LoginStreamService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const userPublicId = localStorage.getItem('userPublicId');
    const userId = localStorage.getItem('userId');
    if (userPublicId) {
      void this.loginStreamService.getCurrentUser(userPublicId);
    } else if (userId) {
      void this.loginStreamService.getCurrentUser(userId);
    }

    this.userSub = this.loginStreamService.currentUserStream.subscribe(user => {
      this.avatarLetter = this.resolveAvatarLetter(user?.username);
    });
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
  }

  private resolveAvatarLetter(username?: string): string {
    const trimmed = username?.trim();
    if (!trimmed) {
      return 'U';
    }
    return trimmed.charAt(0).toUpperCase();
  }

  public openProfile() {
    this.router.navigate(['/profile']);
  }

  public goHome() {
    this.router.navigate(['/game']);
  }

  public logoutUser() {
    this.loginStreamService.logout();

    this.router.navigate(['/login']);
  }
}
