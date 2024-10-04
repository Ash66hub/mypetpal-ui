import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { lastValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment.prod';
import { User } from '../../../shared/user/user';

export interface AuthResponse {
  token: string;
  refreshToken: string;
  userId: string;
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

  public getToken(userId: string, refreshToken: string): Promise<string> {
    const body = {
      userId: userId,
      token: refreshToken
    };

    return lastValueFrom(
      this.http.post<string>(this.apiUrl + 'Authentication/refreshToken', body)
    );
  }
}
