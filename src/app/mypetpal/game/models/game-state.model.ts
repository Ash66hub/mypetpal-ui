import * as Phaser from 'phaser';
import { DecorInstance } from '../../../core/decor/decor.service';

export interface PlayerState {
  currentLevel: number;
  currentExp: number;
}

export interface RoomState {
  activeRoomId: string | null;
  roomOwnerId: string | null;
  remotePets: Map<string, Phaser.GameObjects.Sprite>;
  remoteChatBubbles: Map<string, Phaser.GameObjects.Container[]>;
}

export interface PetDisplay {
  sprite: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  texture: string;
}

export interface ChatBubble {
  container: Phaser.GameObjects.Container;
  text: string;
  createdAt: number;
}

export interface DecorState {
  selectedDecor: Phaser.GameObjects.Sprite | null;
  isDraggingDecor: boolean;
  decorSprites: Phaser.GameObjects.Group | null;
}

export interface GameCamera {
  x: number;
  y: number;
  zoom: number;
}
