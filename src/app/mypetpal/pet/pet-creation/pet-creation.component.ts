import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Pet, PetStatus, PetType } from '../pet';
import { PetStreamService } from '../pet-service/pet-stream.service';
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
    private petStream: PetStreamService
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

  public onSubmit() {
    if (this.petForm.valid) {
      let pet = new Pet();

      pet = {
        petName: this.petForm.get('name')?.value,
        petLevel: 0,
        petStatus: PetStatus.NEUTRAL,
        petType: this.petForm.get('petType')?.value,
        age: 0,
        xp: 0,
        happiness: 0,
        health: 100
      };

      console.log('pet', pet);
      // this.petStream.createPet(formData).subscribe(response => {
      //   console.log('Pet created successfully!', response);
      // });
    }
  }
}
