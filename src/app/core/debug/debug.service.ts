import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DebugService {
  debugMode = false;

  toggle(): boolean {
    this.debugMode = !this.debugMode;
    return this.debugMode;
  }
}
