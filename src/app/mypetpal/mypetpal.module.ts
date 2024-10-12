import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginComponent } from '../core/login/login.component';

import { SharedModule } from '../shared/shared.module';
import { LoginService } from '../core/login/login-service/login.service';
import { GameComponent } from './game/game.component';
import { TopBarComponent } from './top-bar/top-bar.component';
import { PetComponent } from './pet/pet.component';

@NgModule({
  declarations: [LoginComponent, GameComponent, TopBarComponent, PetComponent],
  imports: [CommonModule, SharedModule],
  exports: [TopBarComponent],
  schemas: [],
  providers: [LoginService]
})
export class MypetpalModule {}
