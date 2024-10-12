export enum PetType {
  DOGO = 'Dogo',
  CATO = 'Cato'
}

export enum PetStatus {
  NEUTRAL = 'Neutral',
  HAPPY = 'Happy',
  SAD = 'Sad',
  DEAD = 'Dead'
}

export class Pet {
  public petid: string;
  public petName: string;
  public petType: PetType;
  public petLevel: number;
  public age: number;
  public petStatus: PetStatus;
  public petAvatar?: string;

  // Pet stats max:100
  public xp: number;
  public health: number;
  public happiness: number;
}
