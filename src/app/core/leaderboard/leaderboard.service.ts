import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LeaderboardPlayer {
  userId: number;
  id?: string;
  username: string;
  profilePictureUrl?: string;
  level: number;
  experience: number;
}

@Injectable({
  providedIn: 'root'
})
export class LeaderboardService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  public getTopPlayers(top = 10): Observable<LeaderboardPlayer[]> {
    return this.http.get<LeaderboardPlayer[]>(
      `${this.apiUrl}Users/leaderboard?top=${top}`
    );
  }
}
