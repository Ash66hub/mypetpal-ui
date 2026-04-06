import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserSettings {
  userId: number;
  lastPetX: number;
  lastPetY: number;
  lastCameraX: number;
  lastCameraY: number;
  zoomLevel: number;
  isMuted: boolean;
  musicVolume: number;
  soundVolume: number;
  musicEnabled: boolean;
  neighborhoodPanelCollapsed: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserSettingsService {
  private apiUrl = `${environment.apiUrl}api/UserSettings`;

  constructor(private http: HttpClient) {}

  getSettings(userId: number): Observable<UserSettings> {
    return this.http.get<UserSettings>(`${this.apiUrl}/${userId}`);
  }

  saveSettings(settings: UserSettings): Observable<void> {
    return this.http.post<void>(this.apiUrl, settings);
  }
}
