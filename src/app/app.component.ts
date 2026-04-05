import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { LoginStreamService } from './core/login/login-service/login-stream.service';
import { filter } from 'rxjs/operators';
import { HealthService } from './core/health/health.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  standalone: false
})
export class AppComponent implements OnInit {
  isLoggedIn = false;
  isLoginPage = true;
  isServerDown = false;

  constructor(
    private router: Router,
    private loginStream: LoginStreamService,
    private healthService: HealthService
  ) {
    // Proactively check localStorage so the header doesn't flicker on load
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const refreshToken = localStorage.getItem('refreshToken');
    this.isLoggedIn = !!(token && userId && refreshToken);
  }

  ngOnInit(): void {
    this.healthService.checkServerHealth().subscribe(isHealthy => {
      this.isServerDown = !isHealthy;
    });

    // Check if we are on the login page
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.isLoginPage = event.urlAfterRedirects === '/login' || event.url === '/login';
    });

    // Subscribing to logged in user stream
    this.loginStream.currentUserStream.subscribe((user: any) => {
      this.isLoggedIn = !!(user && user.userId);
    });

    // If starting out, and no tokens, ensure at login
    // The AuthGuard handles the /game -> /login transition, 
    // but app-root should stay silent on redirects if already set.
  }
}
