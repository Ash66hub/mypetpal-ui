import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { LoginStreamService } from '../login/login-service/login-stream.service';
import { PetStreamService } from '../../mypetpal/pet/pet-service/pet-stream.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private loginStreamService: LoginStreamService,
    private petStreamService: PetStreamService,
    private router: Router
  ) {}

  async canActivate(): Promise<boolean> {
    const refreshToken = localStorage.getItem('refreshToken');
    const userId = localStorage.getItem('userId');
    const accessToken = localStorage.getItem('token');

    if (refreshToken && userId && accessToken) {
      // Rehydrate user stream so header/components have the right state
      await this.loginStreamService.getCurrentUser(userId);

      // Rehydrate pet stream and decide where to send the user
      try {
        await this.petStreamService.getUserPets(userId);
        const pet = this.petStreamService.currentPetStream.getValue();

        if (!pet || !pet.petId) {
          this.router.navigate(['/petCreation']);
          return false;
        }
      } catch {
        // Pet fetch failed — still let them into game; game can handle empty pet state
      }

      return true;
    } else {
      this.router.navigate(['/login']);
      return false;
    }
  }
}
