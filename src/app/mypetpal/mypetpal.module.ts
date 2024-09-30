import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginComponent } from '../core/login/login.component';

import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [LoginComponent],
  imports: [CommonModule, SharedModule],
  schemas: []
})
export class MypetpalModule {}
