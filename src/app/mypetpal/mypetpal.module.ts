import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginComponent } from '../core/login/login.component';

import { SharedModule } from '../shared/shared.module';
import { LoginService } from '../core/login/login-service/login.service';

@NgModule({
  declarations: [LoginComponent],
  imports: [CommonModule, SharedModule],
  schemas: [],
  providers: [LoginService]
})
export class MypetpalModule {}
