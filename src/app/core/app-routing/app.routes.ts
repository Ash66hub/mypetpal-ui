import { Routes } from '@angular/router';
import { LoginComponent } from '../login/login.component';
import { GameComponent } from '../../mypetpal/game/game.component';
import { AuthGuard } from './route-guard';
import { PetGuard } from './pet-guard';
import { PetCreationComponent } from '../../mypetpal/pet/pet-creation/pet-creation.component';
import { ProfileComponent } from '../../mypetpal/profile/profile.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
  { path: '', redirectTo: '/game', pathMatch: 'full' },
  { path: 'game', component: GameComponent, canActivate: [AuthGuard] },
  { path: 'game/:roomOwnerId', component: GameComponent, canActivate: [AuthGuard] },
  {
    path: 'petCreation',
    component: PetCreationComponent,
    canActivate: [PetGuard]
  },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [AuthGuard]
  }
];

