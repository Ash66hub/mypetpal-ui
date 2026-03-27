import { Injectable, signal, WritableSignal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

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

@Injectable({
  providedIn: 'root'
})
export class FriendService {
  private apiUrl = environment.apiUrl + 'social';
  private hubUrl = environment.apiUrl + 'socialHub';
  private hubConnection!: signalR.HubConnection;

  public incomingRequests = signal<FriendRequest[]>([]);
  public friends = signal<Friend[]>([]);
  public newRequestNotification = signal<string | null>(null);
  public searchResults = signal<UserSearchResult[]>([]);

  // UI State for Social Panel & Profile
  public activeTab = signal<'friends' | 'requests' | 'search' | 'profile'>('friends');
  public isCollapsed = signal<boolean>(false);

  constructor(private http: HttpClient) {
    this.refreshSocialData();
  }

  public initHub(userId: string) {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(this.hubUrl, {
        withCredentials: true
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection.start()
      .then(() => {
        console.log('SignalR connected');
        this.hubConnection.invoke('JoinUserGroup', userId);
      })
      .catch(err => console.error('SignalR Error: ', err));

    this.hubConnection.on('ReceiveFriendRequest', (senderUsername: string) => {
      this.newRequestNotification.set(senderUsername);
      this.refreshPendingRequests();
    });

    this.hubConnection.on('FriendRequestAccepted', (friendUsername: string) => {
      this.refreshFriends();
    });

    this.hubConnection.on('UserStatusChanged', (userId: string, isOnline: boolean) => {
      const uId = parseInt(userId);
      
      // Update Friends signal
      this.friends.update(current => current.map(f => f.userId === uId ? { ...f, isOnline } : f));

      // Update Search Results signal
      this.searchResults.update(current => current.map(r => r.userId === uId ? { ...r, isOnline } : r));
    });
  }

  public searchUsers(query: string, currentUserId: number): Observable<UserSearchResult[]> {
    return this.http.get<UserSearchResult[]>(`${this.apiUrl}/search?query=${query}&currentUserId=${currentUserId}`).pipe(
      tap((results: UserSearchResult[]) => this.searchResults.set(results))
    );
  }

  public sendRequest(userId: number, targetId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/request?userId=${userId}&targetId=${targetId}`, {});
  }

  public respondToRequest(requestId: number, accept: boolean): Observable<any> {
    return this.http.post(`${this.apiUrl}/respond?requestId=${requestId}&accept=${accept}`, {});
  }

  public removeFriend(userId: number, friendId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/remove?userId=${userId}&friendId=${friendId}`);
  }

  public refreshSocialData() {
    this.refreshFriends();
    this.refreshPendingRequests();
  }

  private refreshFriends() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    this.http.get<Friend[]>(`${this.apiUrl}/list?userId=${userId}`).subscribe(friends => {
      this.friends.set(friends);
    });
  }

  private refreshPendingRequests() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    this.http.get<FriendRequest[]>(`${this.apiUrl}/pending?userId=${userId}`).subscribe(requests => {
      this.incomingRequests.set(requests);
    });
  }
  
  public clearNotification() {
      this.newRequestNotification.set(null);
  }
}
