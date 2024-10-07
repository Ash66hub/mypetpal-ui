import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { from } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { LoginStreamService } from '../login/login-service/login-stream.service';
import { LoginService } from '../login/login-service/login.service';

export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const loginStreamService = inject(LoginStreamService);
  const loginService = inject(LoginService);
  const router = inject(Router);

  let token = loginStreamService.getToken();

  if (!token || loginStreamService.isTokenExpired()) {
    const userId = localStorage.getItem('userId');
    const refreshToken = loginStreamService.getRefreshToken();

    if (refreshToken && userId) {
      return from(loginService.getToken(userId, refreshToken)).pipe(
        switchMap((newToken: string) => {
          token = newToken;
          localStorage.setItem('token', token);

          const clonedReq = req.clone({
            setHeaders: {
              Authorization: `Bearer ${token}`
            }
          });

          return next(clonedReq);
        }),
        catchError(() => {
          router.navigate(['/login']);
          return next(req);
        })
      );
    } else {
      router.navigate(['/login']);
      return next(req);
    }
  }

  const clonedReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(clonedReq);
};
