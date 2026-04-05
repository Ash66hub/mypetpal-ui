import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { LoginStreamService } from '../login/login-service/login-stream.service';
import { PetStreamService } from '../../mypetpal/feature/pet/pet-service/pet-stream.service';

/**
 * Guards the /petCreation route.
 * - If not authenticated → /login
 * - If already has a pet  → /game  (no need to create another one)
 * - Otherwise             → allow through to pet creation
 */
@Injectable({
  providedIn: 'root'
})
export class PetGuard implements CanActivate {
  constructor(
    private loginStreamService: LoginStreamService,
    private petStreamService: PetStreamService,
    private router: Router
  ) {}

  async canActivate(): Promise<boolean> {
    const refreshToken = localStorage.getItem('refreshToken');
    const userId = localStorage.getItem('userId');
    const accessToken = localStorage.getItem('token');

    // Not authenticated at all → /login
    if (
      !refreshToken ||
      !userId ||
      !accessToken ||
      !this.loginStreamService.hasAuthenticatedSession()
    ) {
      this.router.navigate(['/login']);
      return false;
    }

    // Rehydrate user stream
    await this.loginStreamService.getCurrentUser(userId);

    // Check if a pet already exists for this user
    try {
      await this.petStreamService.getUserPets(userId);
      const pet = this.petStreamService.currentPetStream.getValue();

      if (pet && pet.petId) {
        // Already has a pet — redirect to game
        this.router.navigate(['/game']);
        return false;
      }
    } catch {
      // If pet fetch fails, let them through to pet creation
    }

    return true;
  }
}
