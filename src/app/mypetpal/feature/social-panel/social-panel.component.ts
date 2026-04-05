import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import {
  FriendService,
  UserSearchResult,
  Friend,
  FriendRequest
} from '../../../core/social/friend.service';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../../shared/dialogs/confirm-dialog.component';
import { FormsModule } from '@angular/forms';
import { LoginStreamService } from '../../../core/login/login-service/login-stream.service';
import { PetStreamService } from '../pet/pet-service/pet-stream.service';
import { User } from '../../../shared/user/user';
import { Pet } from '../pet/pet';
import { Router } from '@angular/router';
import { SharedModule } from '../../../shared/shared.module';

@Component({
  selector: 'app-social-panel',
  standalone: true,
  templateUrl: './social-panel.component.html',
  styleUrls: ['./social-panel.component.scss'],
  imports: [SharedModule]
})
export class SocialPanelComponent implements OnInit {
  get activeTab() {
    return this.friendService.activeTab();
  }
  get isCollapsed() {
    return this.friendService.isCollapsed();
  }

  public searchQuery: string = '';
  public currentUserId: number = 0;

  public currentUser: User | null = null;
  public currentPet: Pet | null = null;

  public isSearching: boolean = false;
  public isSearchPerformed: boolean = false;

  @Input() isVisiting: boolean = false;
  @Input() isHosting: boolean = false;
  @Input() visitingUsername: string = '';
  @Input() hostingCount: number = 0;
  @Input() visitingUserIds: number[] = [];

  @Output() onReturnHome = new EventEmitter<void>();

  constructor(
    public friendService: FriendService,
    private snackbarService: SnackbarService,
    private dialog: MatDialog,
    private loginStreamService: LoginStreamService,
    private petStreamService: PetStreamService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.isMobileViewport()) {
      this.friendService.isCollapsed.set(true);
    }

    const userIdStr = localStorage.getItem('userId');
    if (userIdStr) {
      this.currentUserId = parseInt(userIdStr);
      this.friendService.initHub(userIdStr);
    }

    this.friendService.refreshSocialData();

    // Bind current user and pet streams
    this.loginStreamService.currentUserStream.subscribe(user => {
      this.currentUser = user;
    });

    this.petStreamService.currentPetStream.subscribe(pet => {
      this.currentPet = pet;
    });
  }

  private isMobileViewport(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 768;
  }

  public toggleCollapse() {
    this.friendService.isCollapsed.update(v => !v);
    if (!this.isCollapsed) {
      this.friendService.refreshSocialData();
    }
  }

  public expandPanel(): void {
    this.friendService.isCollapsed.set(false);
    this.friendService.refreshSocialData();
  }

  public setTab(tab: 'friends' | 'requests' | 'search' | 'profile') {
    this.friendService.activeTab.set(tab);
    if (tab !== 'profile') {
      this.friendService.refreshSocialData();
    }
    if (tab === 'requests') {
      this.friendService.clearNotification();
      this.friendService.clearVisitNotification();
    }
  }

  public onSearchChange(val: any) {
    if (typeof val === 'string') {
      this.searchQuery = val;
    }
  }

  public performSearch() {
    const query = this.searchQuery.trim();
    if (query.length > 0) {
      this.isSearching = true;
      this.isSearchPerformed = true;
      this.friendService.searchUsers(query, this.currentUserId).subscribe({
        next: () => {
          this.isSearching = false;
        },
        error: () => {
          this.isSearching = false;
          this.isSearchPerformed = true;
        }
      });
    } else {
      this.friendService.searchResults.set([]);
      this.isSearching = false;
      this.isSearchPerformed = false;
    }
  }

  public clearSearch() {
    this.searchQuery = '';
    this.friendService.searchResults.set([]);
    this.isSearching = false;
    this.isSearchPerformed = false;
  }

  public returnHome() {
    this.onReturnHome.emit();
  }

  public sendRequest(targetId: number) {
    this.friendService.sendRequest(this.currentUserId, targetId).subscribe({
      next: () => {
        // Refresh search results to show "Pending"
        this.performSearch();
        this.snackbarService.openSnackbarWithAction('Friend request sent!');
      },
      error: err => {
        if (err.status === 409) {
          this.snackbarService.openSnackbarWithAction('Request already sent');
        } else {
          this.snackbarService.openSnackbarWithAction(
            'Action unavailable. Please try again later.'
          );
        }
      }
    });
  }

  public respond(requestId: number, accept: boolean) {
    this.friendService.respondToRequest(requestId, accept).subscribe(() => {
      this.friendService.refreshSocialData();
      const msg = accept ? 'Request accepted!' : 'Request declined.';
      this.snackbarService.openSnackbarWithAction(msg);
    });
  }

  public sendVisitInvite(friendId: number) {
    if (!this.canInviteToRoom(friendId)) {
      this.snackbarService.openSnackbarWithAction(
        'This pal is already visiting your space.'
      );
      return;
    }

    this.friendService.sendVisitInvite(this.currentUserId, friendId).subscribe({
      next: () => {
        this.snackbarService.openSnackbarWithAction('Visit invitation sent!');
      },
      error: err => {
        if (err.status === 409) {
          this.snackbarService.openSnackbarWithAction(
            'Invitation already sent'
          );
        } else {
          this.snackbarService.openSnackbarWithAction(
            'Action unavailable. Please try again later.'
          );
        }
      }
    });
  }

  public canInviteToRoom(friendId: number): boolean {
    return !this.visitingUserIds.includes(friendId);
  }

  public getInviteTooltip(friend: Friend): string {
    if (!friend.isOnline) {
      return 'Cannot invite, pal is offline';
    }

    if (!this.canInviteToRoom(friend.userId)) {
      return 'Already visiting your space';
    }

    return 'Invite to Room';
  }

  public respondToVisitInvite(
    inviteId: number,
    accept: boolean,
    senderId?: number
  ) {
    this.friendService.respondToVisitInvite(inviteId, accept).subscribe(() => {
      this.friendService.refreshSocialData();
      if (accept && senderId != null) {
        this.router.navigate(['/game', senderId]).then(() => {
          // Force a full reload to tear down the old Phaser scene and load the friend's decor
          window.location.reload();
        });
      } else {
        const msg = accept ? 'Invitation accepted!' : 'Invitation declined.';
        this.snackbarService.openSnackbarWithAction(msg);
      }
    });
  }

  public removeFriend(friend: Friend) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Remove Pal',
        message: `Are you sure you want to remove ${friend.username} from your pals?`,
        confirmText: 'Remove',
        isDestructive: true
      },
      width: '400px',
      panelClass: 'custom-dialog-panel'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.friendService
          .removeFriend(this.currentUserId, friend.userId)
          .subscribe({
            next: () => {
              this.friendService.refreshSocialData();
              this.snackbarService.openSnackbarWithAction(
                `${friend.username} has been removed.`
              );
            },
            error: err => {
              console.error('Remove pal error:', err);
              this.snackbarService.openSnackbarWithAction(
                'Action unavailable. Please try again later.'
              );
            }
          });
      }
    });
  }
}
