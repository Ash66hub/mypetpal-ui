import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginComponent } from '../core/login/login.component';

import { SharedModule } from '../shared/shared.module';
import { LoginService } from '../core/login/login-service/login.service';
import { GameComponent } from './game/game.component';

@NgModule({
  declarations: [LoginComponent, GameComponent],
  imports: [CommonModule, SharedModule],
  schemas: [],
  providers: [LoginService]
})
export class MypetpalModule {}
