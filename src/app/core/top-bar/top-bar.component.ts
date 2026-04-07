import { Component, OnDestroy, OnInit } from '@angular/core';
import { LoginStreamService } from '../../core/login/login-service/login-stream.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { AboutDialogComponent } from '../../shared/dialogs/about-dialog.component';

@Component({
  selector: 'app-top-bar',
  templateUrl: './top-bar.component.html',
  styleUrls: ['./top-bar.component.scss'],
  standalone: false
})
export class TopBarComponent implements OnInit, OnDestroy {
  public avatarLetter: string = 'U';
  public avatarUrl?: string;
  private userSub?: Subscription;

  constructor(
    private loginStreamService: LoginStreamService,
    private router: Router,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    const id = localStorage.getItem('id');
    const userId = localStorage.getItem('userId');
    if (id) {
      void this.loginStreamService.getCurrentUser(id);
    } else if (userId) {
      void this.loginStreamService.getCurrentUser(userId);
    }

    this.userSub = this.loginStreamService.currentUserStream.subscribe(user => {
      this.avatarLetter = this.resolveAvatarLetter(user?.username);
      this.avatarUrl = user?.profilePictureUrl;
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

  public replayTutorial(): void {
    const userId = localStorage.getItem('id') || localStorage.getItem('userId');

    if (userId) {
      localStorage.setItem('firstTimeTutorialPendingFor', userId);
      localStorage.removeItem(`firstTimeTutorialCompleted:${userId}`);
    }

    window.dispatchEvent(new CustomEvent('replay-tutorial'));
    this.router.navigate(['/game']);
  }

  public openAbout(): void {
    const ref = this.dialog.open(AboutDialogComponent, {
      width: '420px',
      panelClass: 'custom-dialog-panel'
    });

    ref.afterClosed().subscribe(result => {
      if (result?.debugToggled) {
        window.dispatchEvent(new CustomEvent('debug-toggled', {
          detail: { debugMode: result.debugMode }
        }));
      }
    });
  }

  public logoutUser() {
    this.loginStreamService.logout();

    this.router.navigate(['/login']);
  }
}
