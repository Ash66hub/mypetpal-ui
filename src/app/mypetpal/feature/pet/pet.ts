export enum PetType {
  GoldenRetriever_spritesheet = 'GoldenRetriever_spritesheet',
  Cat_spritesheet = 'Cat_spritesheet'
}

export type RoomKey = 'room1' | 'room2' | 'room3';

export interface PetSelection {
  petAssetKey: PetType;
  roomKey: RoomKey;
}

export enum PetStatus {
  NEUTRAL = 'Neutral',
  HAPPY = 'Happy',
  SAD = 'Sad',
  DEAD = 'Dead'
}

export class Pet {
  public petId?: string;
  public petName: string;
  public petType: PetType;
  public petLevel: number;
  public age: number;
  public petStatus: PetStatus;
  public petAvatar?: string;
  public selection?: PetSelection;
  public metadata?: string;

  // Pet stats max:100
  public xp: number;
  public health: number;
  public happiness: number;
}
