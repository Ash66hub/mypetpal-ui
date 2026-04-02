import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginComponent } from '../core/login/login.component';

import { SharedModule } from '../shared/shared.module';
import { LoginService } from '../core/login/login-service/login.service';
import { GameComponent } from './game/game.component';
import { TopBarComponent } from '../core/top-bar/top-bar.component';
import { PetComponent } from './feature/pet/pet.component';
import { PetCreationComponent } from './feature/pet/pet-creation/pet-creation.component';
import { SocialPanelComponent } from './feature/social-panel/social-panel.component';
import { ProfileComponent } from './feature/profile/profile.component';
import { DecorPanelComponent } from './feature/decor-panel/decor-panel.component';
import { LevelBarComponent } from './feature/level-bar/level-bar.component';

@NgModule({
  declarations: [
    LoginComponent,
    GameComponent,
    TopBarComponent,
    PetComponent,
    PetCreationComponent,
    LevelBarComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    SocialPanelComponent,
    ProfileComponent,
    DecorPanelComponent
  ],
  exports: [TopBarComponent],
  schemas: [],
  providers: [LoginService]
})
export class MypetpalModule {}
