import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { LoginService } from '../login/login-service/login.service';
import { LoginStreamService } from '../login/login-service/login-stream.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private loginStreamService: LoginStreamService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean> | boolean {
    const refreshToken = localStorage.getItem('refreshToken');
    const userId = localStorage.getItem('userId');
    const accessToken = localStorage.getItem('token');

    if (refreshToken && userId && accessToken) {
      this.loginStreamService.getCurrentUser(userId);

      return true;
    } else {
      this.router.navigate(['/login']);

      return false;
    }
  }
}
