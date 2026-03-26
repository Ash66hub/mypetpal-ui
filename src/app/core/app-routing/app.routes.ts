import { Routes } from '@angular/router';
import { LoginComponent } from '../login/login.component';
import { GameComponent } from '../../mypetpal/game/game.component';
import { AuthGuard } from './route-guard';
import { PetCreationComponent } from '../../mypetpal/pet/pet-creation/pet-creation.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'game', component: GameComponent, canActivate: [AuthGuard] },
  {
    path: 'petCreation',
    component: PetCreationComponent,
    canActivate: [AuthGuard]
  }
];
