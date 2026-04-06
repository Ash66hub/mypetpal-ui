import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { lastValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { User } from '../../../shared/user/user';

export interface AuthResponse {
  token: string;
  refreshToken: string;
  userId: string;
  id?: string;
}

export interface RefreshResponse {
  token: string;
  refreshToken: string;
}

export interface SocialSignInRequest {
  accessToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordWithCodeRequest {
  email: string;
  code: string;
  newPassword: string;
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
    return lastValueFrom(this.http.post(this.apiUrl + 'Users/signup', user));
  }

  public getUser(userId: string): Promise<User> {
    const url = `${this.apiUrl}Users/${userId}`;

    return lastValueFrom(this.http.get<User>(url)).catch(error => {
      console.error(`Error fetching user with ID: ${userId}`, error);
      throw error;
    });
  }

  public getUserById(id: string): Promise<User> {
    const url = `${this.apiUrl}Users/id/${id}`;

    return lastValueFrom(this.http.get<User>(url)).catch(error => {
      console.error(`Error fetching user with ID: ${id}`, error);
      throw error;
    });
  }

  public updateProfilePicture(userId: string, file: File): Promise<User> {
    const url = `${this.apiUrl}Users/${userId}/profile-picture`;
    const formData = new FormData();
    formData.append('file', file, file.name);

    return lastValueFrom(this.http.post<User>(url, formData));
  }

  public getToken(
    userId: string,
    refreshToken: string
  ): Promise<RefreshResponse> {
    const body = {
      userId: userId,
      refreshToken: refreshToken
    };

    return lastValueFrom(
      this.http.post<RefreshResponse>(
        this.apiUrl + 'Authentication/refreshToken',
        body
      )
    );
  }

  public deleteAccount(userId: number): Promise<any> {
    return lastValueFrom(
      this.http.delete(`${this.apiUrl}Authentication/delete-account/${userId}`)
    );
  }

  public changePassword(requestData: any): Promise<any> {
    return lastValueFrom(
      this.http.post(
        `${this.apiUrl}Authentication/change-password`,
        requestData
      )
    );
  }

  public setPassword(requestData: any): Promise<any> {
    return lastValueFrom(
      this.http.post(`${this.apiUrl}Authentication/set-password`, requestData)
    );
  }

  public googleSignIn(accessToken: string): Promise<AuthResponse> {
    const body: SocialSignInRequest = { accessToken };
    return lastValueFrom(
      this.http.post<AuthResponse>(
        `${this.apiUrl}Authentication/google-signin`,
        body
      )
    );
  }

  public requestPasswordResetCode(email: string): Promise<{ message: string }> {
    const body: ForgotPasswordRequest = { email };
    return lastValueFrom(
      this.http.post<{ message: string }>(
        `${this.apiUrl}Authentication/forgot-password/request`,
        body
      )
    );
  }

  public resetPasswordWithCode(
    requestData: ResetPasswordWithCodeRequest
  ): Promise<{ message: string }> {
    return lastValueFrom(
      this.http.post<{ message: string }>(
        `${this.apiUrl}Authentication/forgot-password/reset`,
        requestData
      )
    );
  }
}
