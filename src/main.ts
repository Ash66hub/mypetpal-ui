import { enableProdMode, provideZoneChangeDetection } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module'; // Import your AppModule

platformBrowserDynamic()
  .bootstrapModule(AppModule, {
    applicationProviders: [provideZoneChangeDetection()]
  })
  .catch(err => console.error(err));
