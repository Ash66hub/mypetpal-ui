import { Injectable } from '@angular/core';
import { LoginService } from './login.service';
import { User } from '../../../shared/user/user';
import { BehaviorSubject, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoginStreamService {
  public currentUserStream = new BehaviorSubject<User>({});

  constructor(private loginService: LoginService) {}

  public async loginUser(user: User): Promise<void> {
    const response = await this.loginService.authenticateUser(user);

    if (response) {
      this.storeTokensInlocalStorage(
        response.token,
        response.refreshToken,
        response.userId
      );
    }
  }

  public async signUpUser(user: User): Promise<User> {
    return this.loginService.createNewUser(user);
  }

  private storeTokensInlocalStorage(
    token: string,
    refreshToken: string,
    userId: string
  ): void {
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('userId', userId);

    const expiresIn = 60 * 60 * 1000;
    const expirationTime = Date.now() + expiresIn;
    localStorage.setItem('tokenExpiration', expirationTime.toString());
  }

  public getToken(): string | null {
    return localStorage.getItem('token');
  }

  public getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  public isTokenExpired(): boolean {
    const expirationTime = localStorage.getItem('tokenExpiration');
    if (expirationTime) {
      const expTime = parseInt(expirationTime, 10);

      // Check if the current time is within 5 minutes before the expiration time
      return Date.now() > expTime - 300000; // 300,000 ms = 5 minutes
    }
    return true; // Token is expired if no expiration time is found
  }

  public async getCurrentUser(userId: string) {
    this.currentUserStream.next(await this.loginService.getUser(userId));
  }

  public logout() {
    this.storeTokensInlocalStorage('', '', '');

    this.currentUserStream.next({});
  }
}
