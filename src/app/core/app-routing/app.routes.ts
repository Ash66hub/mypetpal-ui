import { Routes } from '@angular/router';
import { LoginComponent } from '../login/login.component';
import { GameComponent } from '../../mypetpal/game/game.component';
import { AuthGuard } from './route-guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'game', component: GameComponent, canActivate: [AuthGuard] }
];
