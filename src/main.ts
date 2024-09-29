import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module'; // Import your AppModule


platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch(err => console.error(err));