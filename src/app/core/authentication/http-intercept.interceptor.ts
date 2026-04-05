import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { from, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { LoginStreamService } from '../login/login-service/login-stream.service';
import {
  LoginService,
  RefreshResponse
} from '../login/login-service/login.service';

export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const loginStreamService = inject(LoginStreamService);
  const loginService = inject(LoginService);
  const router = inject(Router);

  // Skip token injection only for truly anonymous endpoints.
  const lowerUrl = req.url.toLowerCase();
  const isAnonymousEndpoint =
    lowerUrl.endsWith('/authentication') ||
    lowerUrl.endsWith('/authentication/refreshtoken') ||
    lowerUrl.endsWith('/authentication/google-signin') ||
    lowerUrl.endsWith('/users/signup');

  if (isAnonymousEndpoint) {
    return next(req);
  }

  let token = loginStreamService.getToken();

  if (!token || loginStreamService.isTokenExpired()) {
    const userId = localStorage.getItem('userId');
    const refreshToken = loginStreamService.getRefreshToken();

    if (refreshToken && userId) {
      return from(loginService.getToken(userId, refreshToken)).pipe(
        switchMap((response: RefreshResponse) => {
          // Store both the new access token AND the rotated refresh token
          localStorage.setItem('token', response.token);
          localStorage.setItem('refreshToken', response.refreshToken);
          // Update expiration
          const expiresIn = 60 * 60 * 1000;
          localStorage.setItem(
            'tokenExpiration',
            (Date.now() + expiresIn).toString()
          );

          const clonedReq = req.clone({
            setHeaders: { Authorization: `Bearer ${response.token}` }
          });

          return next(clonedReq);
        }),
        catchError(error => {
          loginStreamService.logout();
          router.navigate(['/login']);
          return from([]);
        })
      );
    } else {
      // No refresh token available — redirect to login
      loginStreamService.logout();
      router.navigate(['/login']);
      return from([]);
    }
  }

  const clonedReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(clonedReq);
};
