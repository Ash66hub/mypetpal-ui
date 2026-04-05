import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  LeaderboardPlayer,
  LeaderboardService
} from '../../../core/leaderboard/leaderboard.service';
import { FriendService } from '../../../core/social/friend.service';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';
import { SharedModule } from '../../../shared/shared.module';

@Component({
  selector: 'app-leaderboard-panel',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './leaderboard-panel.component.html',
  styleUrls: ['./leaderboard-panel.component.scss']
})
export class LeaderboardPanelComponent implements OnInit {
  private readonly gameRouteContextStorageKey = 'mpp_game_route_context';

  public leaderboardPlayers: LeaderboardPlayer[] = [];
  public isLeaderboardLoading: boolean = false;
  public leaderboardError: string | null = null;
  public currentUserId: number = 0;
  private requestedFromLeaderboard = new Set<number>();
  private sendingFriendRequestUserIds = new Set<number>();

  constructor(
    private leaderboardService: LeaderboardService,
    public friendService: FriendService,
    private snackbarService: SnackbarService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const userIdStr = localStorage.getItem('userId');
    if (userIdStr) {
      const parsed = parseInt(userIdStr, 10);
      if (!Number.isNaN(parsed)) {
        this.currentUserId = parsed;
      }
    }

    this.loadLeaderboard();
  }

  public refreshLeaderboard(): void {
    this.loadLeaderboard(true);
  }

  public sendFriendRequestFromLeaderboard(player: LeaderboardPlayer): void {
    if (!this.canSendFriendRequest(player)) {
      return;
    }

    this.sendingFriendRequestUserIds.add(player.userId);

    this.friendService
      .sendRequest(this.currentUserId, player.userId)
      .subscribe({
        next: () => {
          this.sendingFriendRequestUserIds.delete(player.userId);
          this.requestedFromLeaderboard.add(player.userId);
          this.snackbarService.openSnackbarWithAction(
            `Friend request sent to ${player.username}!`
          );
        },
        error: err => {
          this.sendingFriendRequestUserIds.delete(player.userId);

          if (err?.status === 409) {
            this.requestedFromLeaderboard.add(player.userId);
            this.snackbarService.openSnackbarWithAction('Request already sent');
            return;
          }

          this.snackbarService.openSnackbarWithAction(
            'Action unavailable. Please try again later.'
          );
        }
      });
  }

  public viewHomeFromLeaderboard(player: LeaderboardPlayer): void {
    const roomOwnerId = String(player.userId);
    sessionStorage.setItem(
      this.gameRouteContextStorageKey,
      JSON.stringify({ mode: 'viewMode', roomOwnerId })
    );

    this.router.navigate(['/game/viewMode'], {
      state: { mode: 'viewMode', roomOwnerId }
    });
  }

  public canSendFriendRequest(player: LeaderboardPlayer): boolean {
    if (!this.currentUserId || player.userId === this.currentUserId) {
      return false;
    }

    if (this.isAlreadyFriend(player.userId)) {
      return false;
    }

    if (this.requestedFromLeaderboard.has(player.userId)) {
      return false;
    }

    if (this.sendingFriendRequestUserIds.has(player.userId)) {
      return false;
    }

    return true;
  }

  public getAddFriendButtonLabel(player: LeaderboardPlayer): string {
    if (player.userId === this.currentUserId) {
      return 'You';
    }

    if (this.isAlreadyFriend(player.userId)) {
      return 'Pal';
    }

    if (this.requestedFromLeaderboard.has(player.userId)) {
      return 'Sent';
    }

    if (this.sendingFriendRequestUserIds.has(player.userId)) {
      return '...';
    }

    return 'Add';
  }

  private isAlreadyFriend(userId: number): boolean {
    return this.friendService
      .friends()
      .some(friend => friend.userId === userId);
  }

  private loadLeaderboard(forceRefresh: boolean = false): void {
    if (
      !forceRefresh &&
      this.leaderboardPlayers.length > 0 &&
      !this.leaderboardError
    ) {
      return;
    }

    this.isLeaderboardLoading = true;
    this.leaderboardError = null;

    this.leaderboardService.getTopPlayers(10).subscribe({
      next: players => {
        this.leaderboardPlayers = players;
        this.isLeaderboardLoading = false;
      },
      error: () => {
        this.isLeaderboardLoading = false;
        this.leaderboardPlayers = [];
        this.leaderboardError =
          'Leaderboard is unavailable right now. Please try again.';
      }
    });
  }
}
