import { Routes } from '@angular/router';
import { LoginComponent } from '../login/login.component';
import { GameComponent } from '../../mypetpal/game/game.component';
import { AuthGuard } from './route-guard';
import { PetGuard } from './pet-guard';
import { PetCreationComponent } from '../../mypetpal/feature/pet/pet-creation/pet-creation.component';
import { ProfileComponent } from '../../mypetpal/feature/profile/profile.component';
import { PrivacyPolicyComponent } from '../../shared/pages/privacy-policy/privacy-policy.component';
import { AboutComponent } from '../../shared/pages/about/about.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
  { path: '', redirectTo: '/game', pathMatch: 'full' },
  { path: 'game', component: GameComponent, canActivate: [AuthGuard] },
  {
    path: 'game/visitMode',
    component: GameComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'game/viewMode',
    component: GameComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'petCreation',
    component: PetCreationComponent,
    canActivate: [PetGuard]
  },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'privacy-policy',
    component: PrivacyPolicyComponent
  },
  {
    path: 'about',
    component: AboutComponent
  }
];
