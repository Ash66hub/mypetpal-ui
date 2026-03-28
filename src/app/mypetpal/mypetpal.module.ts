import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginComponent } from '../core/login/login.component';

import { SharedModule } from '../shared/shared.module';
import { LoginService } from '../core/login/login-service/login.service';
import { GameComponent } from './game/game.component';
import { TopBarComponent } from './top-bar/top-bar.component';
import { PetComponent } from './pet/pet.component';
import { PetCreationComponent } from './pet/pet-creation/pet-creation.component';
import { SocialPanelComponent } from './social-panel/social-panel.component';
import { ProfileComponent } from './profile/profile.component';
import { DecorPanelComponent } from './decor-panel/decor-panel.component';

@NgModule({
  declarations: [
    LoginComponent,
    GameComponent,
    TopBarComponent,
    PetComponent,
    PetCreationComponent,
    SocialPanelComponent,
    ProfileComponent,
    DecorPanelComponent
  ],
  imports: [CommonModule, SharedModule],
  exports: [TopBarComponent],
  schemas: [],
  providers: [LoginService]
})
export class MypetpalModule {}
