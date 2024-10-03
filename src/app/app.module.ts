import { NgModule } from '@angular/core';
import { AppComponent } from './app.component';
import { BrowserModule } from '@angular/platform-browser';
import { AuthenticationModule } from './core/authentication/authentication.module';
import { AppRoutingModule } from './core/app-routing/app-routing.module';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MypetpalModule } from './mypetpal/mypetpal.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {
  HttpClientModule,
  provideHttpClient,
  withInterceptors
} from '@angular/common/http';
import { httpInterceptor } from './core/authentication/http-intercept.interceptor';
import { SharedModule } from './shared/shared.module';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    AuthenticationModule,
    AppRoutingModule,
    MypetpalModule
  ],
  bootstrap: [AppComponent],
  providers: [
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([httpInterceptor]))
  ]
})
export class AppModule {}
