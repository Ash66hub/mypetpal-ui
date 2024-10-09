import { Component } from '@angular/core';
import { LoginStreamService } from '../../core/login/login-service/login-stream.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-top-bar',
  templateUrl: './top-bar.component.html',
  styleUrls: ['./top-bar.component.scss']
})
export class TopBarComponent {
  constructor(
    private loginStreamService: LoginStreamService,
    private router: Router
  ) {}

  public logoutUser() {
    this.loginStreamService.logout();

    this.router.navigate(['/login']);
  }
}
