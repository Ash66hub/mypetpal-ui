import { Injectable } from '@angular/core';
import { LoginService } from './login.service';
import { User } from '../../../shared/user/user';
import { BehaviorSubject, Subject } from 'rxjs';
import { SocialAuthService } from './social-auth.service';

@Injectable({
  providedIn: 'root'
})
export class LoginStreamService {
  public currentUserStream = new BehaviorSubject<User>({});
  private readonly authSessionKey = 'authSessionActive';

  constructor(
    private loginService: LoginService,
    private socialAuthService: SocialAuthService
  ) {}

  public async loginUser(user: User): Promise<void> {
    try {
      const response = await this.loginService.authenticateUser(user);

      if (response) {
        this.storeTokensInlocalStorage(
          response.token,
          response.refreshToken,
          response.userId,
          response.userPublicId
        );
        localStorage.setItem('authProvider', 'local');
        localStorage.setItem('hasLocalPassword', 'true');
        await this.getCurrentUser(response.userPublicId ?? response.userId);

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

  public async loginWithGoogle(accessToken: string): Promise<void> {
    const response = await this.loginService.googleSignIn(accessToken);

    if (response) {
      this.storeTokensInlocalStorage(
        response.token,
        response.refreshToken,
        response.userId,
        response.userPublicId
      );
      localStorage.setItem('authProvider', 'google');
      await this.getCurrentUser(response.userPublicId ?? response.userId);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  private storeTokensInlocalStorage(
    token: string,
    refreshToken: string,
    userId: string,
    userPublicId?: string
  ): void {
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('userId', userId);
    if (userPublicId) {
      localStorage.setItem('userPublicId', userPublicId);
    }
    localStorage.setItem(this.authSessionKey, 'true');

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
      return Date.now() > expTime - 300000; // 5-min buffer before actual expiry
    }
    return false; // No expiration stored means no token — not "expired"
  }

  public hasAuthenticatedSession(): boolean {
    return localStorage.getItem(this.authSessionKey) === 'true';
  }

  public async getCurrentUser(userId: string) {
    try {
      const user = await this.resolveAndFetchCurrentUser(userId);
      const resolvedUserId = (user as any)?.userId ?? userId;
      this.currentUserStream.next({
        ...(user || {}),
        userId: resolvedUserId
      });

      const userPublicId = (user as any)?.publicId ?? (user as any)?.PublicId;
      if (userPublicId) {
        localStorage.setItem('userPublicId', userPublicId);
      }

      const authProvider =
        (user as any)?.authProvider ?? (user as any)?.AuthProvider;
      if (authProvider) {
        localStorage.setItem(
          'authProvider',
          String(authProvider).toLowerCase()
        );
      }

      const hasLocalPassword =
        (user as any)?.hasLocalPassword ?? (user as any)?.HasLocalPassword;
      if (typeof hasLocalPassword === 'boolean') {
        localStorage.setItem(
          'hasLocalPassword',
          hasLocalPassword ? 'true' : 'false'
        );
      }
    } catch (error) {
      this.currentUserStream.next({ userId });
      console.error('LoginStreamService: Failed to fetch current user', error);
    }
  }

  private async resolveAndFetchCurrentUser(userIdOrPublicId: string) {
    try {
      return await this.loginService.getUserByPublicId(userIdOrPublicId);
    } catch {
      return this.loginService.getUser(userIdOrPublicId);
    }
  }

  public logout() {
    // Ensure Supabase OAuth session is cleared to prevent silent re-login.
    void this.socialAuthService.signOut().catch(error => {
      console.warn('Supabase sign-out failed:', error);
    });

    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userPublicId');
    localStorage.removeItem('authProvider');
    localStorage.removeItem('hasLocalPassword');
    localStorage.removeItem('tokenExpiration');
    localStorage.removeItem(this.authSessionKey);
    this.currentUserStream.next({});
  }
}
