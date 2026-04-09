import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MiniGameScore {
  userId: number;
  saveTheJunkHighScore: number;
}

@Injectable({
  providedIn: 'root'
})
export class MiniGameScoreService {
  private apiUrl = `${environment.apiUrl}api/MiniGameScores`;

  constructor(private http: HttpClient) {}

  getScores(userId: number): Observable<MiniGameScore> {
    return this.http.get<MiniGameScore>(`${this.apiUrl}/${userId}`);
  }

  updateSaveTheJunkScore(userId: number, score: number): Observable<{ highScore: number }> {
    return this.http.post<{ highScore: number }>(`${this.apiUrl}/${userId}/save-the-junk`, { score });
  }
}
