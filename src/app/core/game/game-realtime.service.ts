import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';
import { Subject, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LeveledUpEvent {
  userId: string;
  newLevel: number;
  totalExperience: number;
}

export interface ExperienceUpdatedEvent {
  userId: string;
  totalExperience: number;
}

@Injectable({
  providedIn: 'root'
})
export class GameRealtimeService {
  private gameHubUrl = environment.apiUrl + 'gameHub';
  private apiUrl = environment.apiUrl;
  private hubConnection!: signalR.HubConnection;
  private handlersRegistered = false;
  private currentUserId: string | null = null;
  private connectPromise: Promise<void> | null = null;

  public leveledUpEvents = new Subject<LeveledUpEvent>();
  public experienceUpdatedEvents = new Subject<ExperienceUpdatedEvent>();

  constructor(private http: HttpClient) {}

  public initHub(userId: string) {
    this.currentUserId = userId;

    if (!this.hubConnection) {
      this.hubConnection = new signalR.HubConnectionBuilder()
        .withUrl(this.gameHubUrl, { withCredentials: true })
        .withAutomaticReconnect()
        .build();

      this.hubConnection.onreconnected(() => {
        if (this.currentUserId) {
          this.hubConnection
            .invoke('JoinPlayerGroup', this.currentUserId)
            .catch(err =>
              console.error('Failed to rejoin game player group:', err)
            );
        }
      });
    }

    if (!this.handlersRegistered) {
      this.hubConnection.on(
        'LeveledUp',
        (userId: string, newLevel: number, totalExperience: number) => {
          this.leveledUpEvents.next({ userId, newLevel, totalExperience });
        }
      );

      this.hubConnection.on(
        'ExperienceUpdated',
        (userId: string, totalExperience: number) => {
          this.experienceUpdatedEvents.next({ userId, totalExperience });
        }
      );

      this.handlersRegistered = true;
    }

    void this.ensureConnected();
  }

  public async updateLastActive(userId: string): Promise<void> {
    const connected = await this.ensureConnected();

    if (
      connected &&
      this.hubConnection?.state === signalR.HubConnectionState.Connected
    ) {
      try {
        await this.hubConnection.invoke('UpdateLastActive', userId);
        return;
      } catch (err) {
        console.warn(
          'SignalR activity update failed, falling back to HTTP.',
          err
        );
      }
    }

    await firstValueFrom(
      this.http.post<void>(`${this.apiUrl}Users/activity?userId=${userId}`, {})
    );
  }

  private async ensureConnected(): Promise<boolean> {
    if (!this.hubConnection) return false;

    if (this.getHubState() === signalR.HubConnectionState.Connected) {
      return true;
    }

    if (this.getHubState() === signalR.HubConnectionState.Disconnected) {
      if (!this.connectPromise) {
        this.connectPromise = this.hubConnection
          .start()
          .then(async () => {
            if (this.currentUserId) {
              await this.hubConnection.invoke(
                'JoinPlayerGroup',
                this.currentUserId
              );
            }
          })
          .catch(err => {
            console.error('GameHub connection failed:', err);
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
}
