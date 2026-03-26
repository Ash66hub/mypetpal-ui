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
    console.log('LoginStreamService: Starting login for user...', user.username);
    try {
      const response = await this.loginService.authenticateUser(user);
      console.log('LoginStreamService: Authentication successful');

      if (response) {
        this.storeTokensInlocalStorage(
          response.token,
          response.refreshToken,
          response.userId
        );
        console.log('LoginStreamService: Tokens stored in localStorage');

        this.currentUserStream.next(response);

        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error('LoginStreamService: Login failed', error);
      throw error;
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

      return Date.now() > expTime - 300000;
    }
    return true;
  }

  public async getCurrentUser(userId: string) {
    try {
      const user = await this.loginService.getUser(userId);
      this.currentUserStream.next({
        ...(user || {}),
        userId: (user as any)?.userId ?? userId
      });
    } catch (error) {
      this.currentUserStream.next({ userId });
      console.error('LoginStreamService: Failed to fetch current user', error);
    }
  }

  public logout() {
    this.storeTokensInlocalStorage('', '', '');

    this.currentUserStream.next({});
  }
}
