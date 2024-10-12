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
    await this.petService.getUserPet(userId).then(pet => {
      this.currentPetStream.next(pet);
    });
  }
}
