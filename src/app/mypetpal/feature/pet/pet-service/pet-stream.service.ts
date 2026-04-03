import { Injectable } from '@angular/core';
import { PetService } from './pet.service';
import { BehaviorSubject } from 'rxjs';
import { Pet } from '../pet';

@Injectable({
  providedIn: 'root'
})
export class PetStreamService {
  public currentPetStream: BehaviorSubject<Pet> = new BehaviorSubject(
    new Pet()
  );

  constructor(private petService: PetService) {}

  public async getUserPets(userId: string) {
    try {
      const pets = await this.petService.getUserPet(userId);

      const pet = Array.isArray(pets) ? pets[0] : pets;
      if (pet) {
        this.currentPetStream.next(pet);
      }
    } catch (error) {
      console.error('PetStreamService: Error fetching pets', error);
      // Re-throw so LoginComponent knows it failed
      throw error;
    }
  }

  public async createUserPet(userId: string, pet: Pet) {
    const newPet = await this.petService.createPet(pet, userId);
    this.currentPetStream.next(newPet);
  }
}
