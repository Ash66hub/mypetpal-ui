import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ReactiveFormsModule } from '@angular/forms';
import { UserComponent } from './user/user.component';
import {
  MatProgressSpinner,
  MatSpinner
} from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatOption } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';

@NgModule({
  declarations: [UserComponent],
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatOption,
    MatInputModule,
    MatTabsModule,
    MatIconModule,
    MatToolbarModule,
    MatProgressSpinner,
    MatMenuModule,
    MatSelectModule
  ],
  exports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatOption,
    MatTabsModule,
    MatIconModule,
    MatToolbarModule,
    MatProgressSpinner,
    MatMenuModule,
    MatSelectModule
  ]
})
export class SharedModule {}
