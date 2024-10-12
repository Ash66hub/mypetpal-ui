import { Component, OnInit } from '@angular/core';
import Phaser from 'phaser';
import { PetStreamService } from '../pet/pet-service/pet-stream.service';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss']
})
export class GameComponent implements OnInit {
  private game: Phaser.Game;
  private targetX: number = 300;
  private targetY: number = 300;

  constructor(private petStreamService: PetStreamService) {}

  ngOnInit(): void {
    this.initializeGame();
    console.log('pet', this.petStreamService.currentPetStream.getValue());
  }

  private initializeGame(): void {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 600,
      height: 600,
      backgroundColor: '#FFFFFF',
      scene: {
        preload: this.preload,
        create: this.create,
        update: this.update
      },
      parent: 'game-container',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false
        }
      }
    };

    this.game = new Phaser.Game(config);
    this.game.canvas.style.backgroundColor = 'transparent';
  }

  preload(this: any): void {
    this.load.image('dog', 'assets/dog.png');
    this.load.image('field', 'assets/field.png');
  }

  create(this: any): void {
    const padding = {
      left: 50,
      right: 50,
      bottom: 130
    };
    const field = this.add.image(300, 300, 'field');

    field.setDisplaySize(600, 600); // Scale the field image to cover the entire game area
    this.dog = this.physics.add.sprite(400, 300, 'dog').setScale(0.1);
    this.dog.setCollideWorldBounds(true);

    // Create custom boundaries
    const worldBounds = this.physics.world.bounds;
    this.physics.world.setBounds(
      worldBounds.x + padding.left,
      worldBounds.y,
      worldBounds.width - (padding.left + padding.right),
      worldBounds.height - padding.bottom,
      true, // enable collision on left
      true,
      true,
      true
    );

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.targetX = pointer.x;
      this.targetY = pointer.y;
      this.physics.moveTo(this.dog, this.targetX, this.targetY, 200);
    });
  }

  update(this: any): void {
    if (this.dog.body.speed > 0) {
      const distance = Phaser.Math.Distance.Between(
        this.dog.x,
        this.dog.y,
        this.targetX,
        this.targetY
      );
      if (distance < 4) {
        this.dog.body.reset(this.targetX, this.targetY);
      }
    }
  }
}
