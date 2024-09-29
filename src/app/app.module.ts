import { NgModule } from '@angular/core';
import { AppComponent } from './app.component';
import { BrowserModule } from '@angular/platform-browser';
import { AuthenticationModule } from './core/authentication/authentication/authentication.module';

@NgModule({
  declarations: [AppComponent,],
  imports: [
    BrowserModule,
    AuthenticationModule


  ],
  bootstrap: [AppComponent]
})

export class AppModule { }
