import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';
import { Observable, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { DecorInstance } from '../decor/decor.service';

export enum FriendshipStatus {
  Pending = 0,
  Accepted = 1,
  Declined = 2,
  Blocked = 3
}

export interface UserSearchResult {
  userId: number;
  username: string;
  isFriend: boolean;
  isPending: boolean;
  isOnline: boolean;
}

export interface Friend {
  userId: number;
  username: string;
  isOnline: boolean;
}

export interface FriendRequest {
  id: number;
  userId: number;
  senderUsername: string;
}

export interface VisitInvite {
  id: number;
  senderId: number;
  senderUsername: string;
  createdAt: string;
}

export interface RoomMoveEvent {
  userId: string;
  x: number;
  y: number;
}

export interface RoomMessageEvent {
  userId: string;
  username: string;
  message: string;
}

export interface RoomDecorSyncEvent {
  userId: string;
  instances: DecorInstance[];
}

export interface UserStatusChangedEvent {
  userId: string;
  isOnline: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FriendService {
  private apiUrl = environment.apiUrl + 'social';
  private hubUrl = environment.apiUrl + 'socialHub';
  private hubConnection!: signalR.HubConnection;
  private handlersRegistered = false;
  private currentUserId: string | null = null;
  private connectPromise: Promise<void> | null = null;

  public incomingRequests = signal<FriendRequest[]>([]);
  public visitInvitations = signal<VisitInvite[]>([]);
  public friends = signal<Friend[]>([]);
  public newRequestNotification = signal<string | null>(null);
  public newVisitNotification = signal<string | null>(null);
  public searchResults = signal<UserSearchResult[]>([]);

  public roomMoveEvents = new Subject<RoomMoveEvent>();
  public roomMessageEvents = new Subject<RoomMessageEvent>();
  public userJoinedRoomEvents = new Subject<string>();
  public userLeftRoomEvents = new Subject<string>();
  public visitAcceptedEvents = new Subject<string>();
  public kickedEvents = new Subject<string>();
  public roomDecorEvents = new Subject<RoomDecorSyncEvent>();
  public userStatusChangedEvents = new Subject<UserStatusChangedEvent>();

  // UI State for Social Panel & Profile
  public activeTab = signal<'friends' | 'requests' | 'search' | 'profile'>(
    'friends'
  );
  public isCollapsed = signal<boolean>(false);

  constructor(private http: HttpClient) {
    this.refreshSocialData();
  }

  public initHub(userId: string) {
    this.currentUserId = userId;

    if (!this.hubConnection) {
      this.hubConnection = new signalR.HubConnectionBuilder()
        .withUrl(this.hubUrl, {
          withCredentials: true
        })
        .withAutomaticReconnect()
        .build();

      this.hubConnection.onreconnected(() => {
        if (this.currentUserId) {
          this.hubConnection
            .invoke('JoinUserGroup', this.currentUserId)
            .catch(err => console.error('Failed to rejoin user group:', err));
        }
      });
    }

    if (!this.handlersRegistered) {
      this.hubConnection.on(
        'ReceiveFriendRequest',
        (senderUsername: string) => {
          this.newRequestNotification.set(senderUsername);
          this.refreshPendingRequests();
        }
      );

      this.hubConnection.on(
        'FriendRequestAccepted',
        (friendUsername: string) => {
          this.refreshFriends();
        }
      );

      this.hubConnection.on(
        'UserStatusChanged',
        (userId: string, isOnline: boolean) => {
          const uId = parseInt(userId);

          this.userStatusChangedEvents.next({ userId, isOnline });

          // Update Friends signal
          this.friends.update(current =>
            current.map(f => (f.userId === uId ? { ...f, isOnline } : f))
          );

          // Update Search Results signal
          this.searchResults.update(current =>
            current.map(r => (r.userId === uId ? { ...r, isOnline } : r))
          );
        }
      );

      this.hubConnection.on('ReceiveVisitInvite', (senderUsername: string) => {
        this.newVisitNotification.set(senderUsername);
        this.refreshVisitInvitations();
      });

      this.hubConnection.on(
        'VisitInviteAccepted',
        (receiverUsername: string) => {
          this.visitAcceptedEvents.next(receiverUsername);
        }
      );

      this.hubConnection.on(
        'PetPositionSynced',
        (userId: string, x: number, y: number) => {
          this.roomMoveEvents.next({ userId, x, y });
        }
      );

      this.hubConnection.on(
        'RoomMessageReceived',
        (userId: string, username: string, message: string) => {
          this.roomMessageEvents.next({ userId, username, message });
        }
      );

      this.hubConnection.on('UserJoinedRoom', (userId: string) => {
        this.userJoinedRoomEvents.next(userId);
      });

      this.hubConnection.on('UserLeftRoom', (userId: string) => {
        this.userLeftRoomEvents.next(userId);
      });

      this.hubConnection.on('KickedFromRoom', (roomOwnerId: string) => {
        this.kickedEvents.next(roomOwnerId);
      });

      this.hubConnection.on(
        'RoomDecorSynced',
        (userId: string, instances: DecorInstance[]) => {
          this.roomDecorEvents.next({ userId, instances });
        }
      );

      this.handlersRegistered = true;
    }

    // Fire-and-forget; room/game operations can await ensureConnected as needed.
    void this.ensureConnected();
  }

  private async ensureConnected(): Promise<boolean> {
    if (!this.hubConnection) return false;

    if (this.getHubState() === signalR.HubConnectionState.Connected) {
      if (this.currentUserId) {
        this.hubConnection
          .invoke('JoinUserGroup', this.currentUserId)
          .catch(err => console.error('Failed to join user group:', err));
      }
      return true;
    }

    if (this.getHubState() === signalR.HubConnectionState.Disconnected) {
      if (!this.connectPromise) {
        this.connectPromise = this.hubConnection
          .start()
          .then(() => {
            if (this.currentUserId) {
              return this.hubConnection.invoke(
                'JoinUserGroup',
                this.currentUserId
              );
            }
            return Promise.resolve();
          })
          .catch(err => {
            console.error('SignalR Error: ', err);
            throw err;
          })
          .finally(() => {
            this.connectPromise = null;
          });
      }

      try {
        await this.connectPromise;
      } catch {
        return false;
      }

      return this.getHubState() === signalR.HubConnectionState.Connected;
    }

    // If currently connecting/reconnecting, wait briefly for the state to settle.
    const started = Date.now();
    const timeoutMs = 2000;
    while (Date.now() - started < timeoutMs) {
      if (this.getHubState() === signalR.HubConnectionState.Connected) {
        return true;
      }
      if (this.getHubState() === signalR.HubConnectionState.Disconnected) {
        break;
      }
      await new Promise(r => setTimeout(r, 100));
    }

    return this.getHubState() === signalR.HubConnectionState.Connected;
  }

  private getHubState(): signalR.HubConnectionState {
    return this.hubConnection.state as signalR.HubConnectionState;
  }

  public searchUsers(
    query: string,
    currentUserId: number
  ): Observable<UserSearchResult[]> {
    return this.http
      .get<
        UserSearchResult[]
      >(`${this.apiUrl}/search?query=${query}&currentUserId=${currentUserId}`)
      .pipe(
        tap((results: UserSearchResult[]) => this.searchResults.set(results))
      );
  }

  public sendRequest(userId: number, targetId: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/request?userId=${userId}&targetId=${targetId}`,
      {}
    );
  }

  public respondToRequest(requestId: number, accept: boolean): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/respond?requestId=${requestId}&accept=${accept}`,
      {}
    );
  }

  public removeFriend(userId: number, friendId: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/remove?userId=${userId}&friendId=${friendId}`
    );
  }

  public sendVisitInvite(
    senderId: number,
    receiverId: number
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/visit-invite?senderId=${senderId}&receiverId=${receiverId}`,
      {}
    );
  }

  public respondToVisitInvite(
    inviteId: number,
    accept: boolean
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/visit-respond?inviteId=${inviteId}&accept=${accept}`,
      {}
    );
  }

  public async joinRoom(roomOwnerId: string, userId: string) {
    if (!(await this.ensureConnected())) return;
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      this.hubConnection
        .invoke('JoinRoom', roomOwnerId, userId)
        .catch(err => console.error('JoinRoom failed:', err));
    }
  }

  public leaveRoom(roomOwnerId: string) {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      this.hubConnection.invoke('LeaveRoom', roomOwnerId);
    }
  }

  public async syncPetPosition(
    roomOwnerId: string,
    x: number,
    y: number,
    userId: string
  ) {
    if (!(await this.ensureConnected())) return;
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      this.hubConnection
        .invoke('SyncPetPosition', roomOwnerId, x, y, userId)
        .catch(err => console.error('SyncPetPosition failed:', err));
    }
  }

  public async sendRoomMessage(
    roomOwnerId: string,
    message: string,
    userId: string,
    username: string
  ) {
    if (!(await this.ensureConnected())) return;
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      this.hubConnection
        .invoke('SendRoomMessage', roomOwnerId, message, userId, username)
        .catch(err => console.error('SendRoomMessage failed:', err));
    }
  }

  public async kickUser(roomOwnerId: string, userIdToKick: string) {
    if (!(await this.ensureConnected())) return;
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      this.hubConnection
        .invoke('KickUser', roomOwnerId, userIdToKick)
        .catch(err => console.error('KickUser failed:', err));
    }
  }

  public async syncRoomDecor(
    roomOwnerId: string,
    userId: string,
    instances: DecorInstance[]
  ) {
    if (!(await this.ensureConnected())) return;
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      this.hubConnection
        .invoke('SyncRoomDecor', roomOwnerId, userId, instances)
        .catch(err => console.error('SyncRoomDecor failed:', err));
    }
  }

  public refreshSocialData() {
    this.refreshFriends();
    this.refreshPendingRequests();
    this.refreshVisitInvitations();
  }

  private refreshFriends() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    this.http
      .get<Friend[]>(`${this.apiUrl}/list?userId=${userId}`)
      .subscribe(friends => {
        this.friends.set(friends);
      });
  }

  private refreshPendingRequests() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    this.http
      .get<FriendRequest[]>(`${this.apiUrl}/pending?userId=${userId}`)
      .subscribe(requests => {
        this.incomingRequests.set(requests);
      });
  }

  private refreshVisitInvitations() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    this.http
      .get<VisitInvite[]>(`${this.apiUrl}/visit-invites?userId=${userId}`)
      .subscribe(invites => {
        this.visitInvitations.set(invites);
      });
  }

  public clearNotification() {
    this.newRequestNotification.set(null);
  }

  public clearVisitNotification() {
    this.newVisitNotification.set(null);
  }
}
