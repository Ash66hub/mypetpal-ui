import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Pet, PetStatus, PetType } from '../pet';
import { PetStreamService } from '../pet-service/pet-stream.service';
import { Router } from '@angular/router';
@Component({
  selector: 'app-pet-creation',
  templateUrl: './pet-creation.component.html',
  styleUrls: ['./pet-creation.component.scss'],
  standalone: false
})
export class PetCreationComponent {
  petForm: FormGroup;
  petTypes = Object.values(PetType); // Populates dropdown

  constructor(
    private fb: FormBuilder,
    private petStream: PetStreamService,
    private router: Router
  ) {
    this.petForm = this.fb.group({
      name: ['', Validators.required],
      petType: ['', Validators.required]
    });
  }

  public onFileSelected(event: any) {
    const file = event.target.files[0];
    this.petForm.patchValue({ avatar: file });
  }

  public async onSubmit() {
    if (this.petForm.valid) {
      const pet: Pet = {
        petName: this.petForm.get('name')?.value,
        petType: this.petForm.get('petType')?.value,
        petLevel: 1,
        petStatus: PetStatus.NEUTRAL,
        age: 0,
        xp: 0,
        happiness: 100,
        health: 100
      };

      const userId = localStorage.getItem('userId');
      if (userId) {
        try {
          await this.petStream.createUserPet(userId, pet);
          this.router.navigate(['/game']);
        } catch (error) {
          console.error('Error creating pet:', error);
        }
      } else {
        console.error('User ID not found in localStorage');
        this.router.navigate(['/login']);
      }
    }
  }
}
