import { Injectable } from '@angular/core';
import { LoginService } from './login.service';
import { User } from '../../../shared/user/user';

@Injectable({
  providedIn: 'root'
})
export class LoginStreamService {
  constructor(private loginService: LoginService) {}

  public async loginUser(user: User): Promise<void> {
    const response = await this.loginService.authenticateUser(user);

    if (response) {
      this.storeTokensInSessionStorage(response.token, response.refreshToken);
    }
  }

  public async signUpUser(user: User): Promise<User> {
    return this.loginService.createNewUser(user);
  }

  private storeTokensInSessionStorage(
    token: string,
    refreshToken: string
  ): void {
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('refreshToken', refreshToken);

    const expiresIn = 60 * 60 * 1000;
    const expirationTime = Date.now() + expiresIn;
    sessionStorage.setItem('tokenExpiration', expirationTime.toString());
  }

  public getToken(): string | null {
    return sessionStorage.getItem('token');
  }

  public getRefreshToken(): string | null {
    return sessionStorage.getItem('refreshToken');
  }

  public isTokenExpired(): boolean {
    const expirationTime = sessionStorage.getItem('tokenExpiration');
    if (expirationTime) {
      const expTime = parseInt(expirationTime, 10);

      // Check if the current time is within 5 minutes before the expiration time
      return Date.now() > expTime - 300000; // 300,000 ms = 5 minutes
    }
    return true; // Token is expired if no expiration time is found
  }
}
