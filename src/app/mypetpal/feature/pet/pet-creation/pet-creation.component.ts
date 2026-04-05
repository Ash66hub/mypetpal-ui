import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Pet, PetSelection, PetStatus, PetType, RoomKey } from '../pet';
import { PetStreamService } from '../pet-service/pet-stream.service';
import { Router } from '@angular/router';
import { LoginStreamService } from '../../../../core/login/login-service/login-stream.service';

interface PetPreviewOption {
  key: PetType;
  label: string;
  description: string;
  previewPath: string;
}

interface RoomPreviewOption {
  key: RoomKey;
  label: string;
  description: string;
  previewPath: string;
}

@Component({
  selector: 'app-pet-creation',
  templateUrl: './pet-creation.component.html',
  styleUrls: ['./pet-creation.component.scss'],
  standalone: false
})
export class PetCreationComponent implements OnInit {
  public petForm: FormGroup;
  public petOptions: PetPreviewOption[] = [
    {
      key: PetType.GoldenRetriever_spritesheet,
      label: 'Golden Retriever',
      description: 'Warm, playful, and loyal.',
      previewPath: '/assets/sprite-animation-dog.gif'
    },
    {
      key: PetType.Cat_spritesheet,
      label: 'Cat',
      description: 'Quick, curious, and sleek.',
      previewPath: '/assets/sprite-animation-cat.gif'
    }
  ];

  public roomOptions: RoomPreviewOption[] = [
    {
      key: 'room1',
      label: 'Room 1',
      description: 'Serene Sage Sanctuary.',
      previewPath: '/assets/room1.png'
    },
    {
      key: 'room2',
      label: 'Room 2',
      description: 'Toasted Clay Studio.',
      previewPath: '/assets/room2.png'
    },
    {
      key: 'room3',
      label: 'Room 3',
      description: "Night Owl's Den.",
      previewPath: '/assets/room3.png'
    }
  ];

  public selectedPetOption: PetType = PetType.GoldenRetriever_spritesheet;
  public selectedRoomOption: RoomKey = 'room1';

  constructor(
    private fb: FormBuilder,
    private petStream: PetStreamService,
    private loginStreamService: LoginStreamService,
    private router: Router
  ) {
    this.petForm = this.fb.group({
      name: ['', Validators.required],
      petType: [this.selectedPetOption, Validators.required],
      roomKey: [this.selectedRoomOption, Validators.required]
    });
  }

  ngOnInit(): void {
    this.selectPet(this.selectedPetOption);
    this.selectRoom(this.selectedRoomOption);
  }

  public selectPet(petType: PetType): void {
    this.selectedPetOption = petType;
    this.petForm.patchValue({ petType });
    this.petForm.get('petType')?.markAsDirty();
  }

  public selectRoom(roomKey: RoomKey): void {
    this.selectedRoomOption = roomKey;
    this.petForm.patchValue({ roomKey });
    this.petForm.get('roomKey')?.markAsDirty();
  }

  public async onSubmit() {
    if (this.petForm.valid) {
      if (!this.loginStreamService.hasAuthenticatedSession()) {
        this.router.navigate(['/login']);
        return;
      }

      const petType = this.petForm.get('petType')?.value as PetType;
      const roomKey = this.petForm.get('roomKey')?.value as RoomKey;

      const selection: PetSelection = {
        petAssetKey: petType,
        roomKey
      };

      const pet: Pet = {
        petName: this.petForm.get('name')?.value,
        petType,
        petAvatar: petType,
        selection,
        petLevel: 1,
        petStatus: PetStatus.NEUTRAL,
        age: 0,
        xp: 0,
        happiness: 100,
        health: 100
      };

      const userPublicId = localStorage.getItem('userPublicId');
      const userId = localStorage.getItem('userId');
      const identifier = userPublicId || userId;
      if (identifier) {
        try {
          await this.petStream.createUserPet(identifier, pet);
          localStorage.setItem('firstTimeTutorialPendingFor', identifier);
          this.router.navigate(['/game']);
        } catch (error) {
          console.error('Error creating pet:', error);
        }
      } else {
        console.error('User identifier not found in localStorage');
        this.router.navigate(['/login']);
      }
    }
  }
}
