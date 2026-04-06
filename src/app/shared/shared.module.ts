import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatOptionModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { RouterModule } from '@angular/router';

import { UserComponent } from './user/user.component';
import { ConfirmDialogComponent } from './dialogs/confirm-dialog.component';
import { AboutDialogComponent } from './dialogs/about-dialog.component';
import { PawSpinnerComponent } from './components/paw-spinner/paw-spinner.component';

@NgModule({
  declarations: [
    UserComponent,
    ConfirmDialogComponent,
    AboutDialogComponent,
    PawSpinnerComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatTabsModule,
    MatIconModule,
    MatToolbarModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatSelectModule,
    MatDialogModule,
    MatSnackBarModule,
    MatOptionModule,
    MatTooltipModule,
    MatDividerModule,
    RouterModule
  ],
  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatTabsModule,
    MatIconModule,
    MatToolbarModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatSelectModule,
    MatDialogModule,
    MatSnackBarModule,
    MatOptionModule,
    MatTooltipModule,
    MatDividerModule,
    RouterModule,
    ConfirmDialogComponent,
    AboutDialogComponent,
    PawSpinnerComponent
  ]
})
export class SharedModule {}
