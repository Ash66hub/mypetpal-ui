import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { lastValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { User } from '../../../shared/user/user';

export interface AuthResponse {
  token: string;
  refreshToken: string;
  userId: string;
}

export interface RefreshResponse {
  token: string;
  refreshToken: string;
}

@Injectable()
export class LoginService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  public authenticateUser(user: User): Promise<AuthResponse> {
    return lastValueFrom(
      this.http.post<AuthResponse>(this.apiUrl + 'Authentication', user)
    );
  }

  public createNewUser(user: User): Promise<User> {
    return lastValueFrom(this.http.post(this.apiUrl + 'Users', user));
  }

  public getUser(userId: string): Promise<User> {
    const url = `${this.apiUrl}Users/${userId}`;

    return lastValueFrom(this.http.get<User>(url)).catch(error => {
      console.error(`Error fetching user with ID: ${userId}`, error);
      throw error;
    });
  }

  public getToken(userId: string, refreshToken: string): Promise<RefreshResponse> {
    const body = {
      userId: userId,
      refreshToken: refreshToken
    };

    return lastValueFrom(
      this.http.post<RefreshResponse>(this.apiUrl + 'Authentication/refreshToken', body)
    );
  }
}
