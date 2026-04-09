import Phaser from 'phaser';

export class AvoidTheJunkScene extends Phaser.Scene {
  private pet: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null = null;
  private junkGroup: Phaser.Physics.Arcade.Group | null = null;
  private goodFoodGroup: Phaser.Physics.Arcade.Group | null = null;
  
  private score = 0;
  private scoreText: Phaser.GameObjects.Text | null = null;
  
  private isGameOver = false;
  private petSpritePath: string = 'assets/GoldenRetriever_spritesheet.png';
  private musicVolume: number = 0.5;
  private startMuted: boolean = false;
  private loadedHighScore: number = 0;
  private gameWidth = 0;
  private gameHeight = 0;

  private spawnTimerCount: number = 0;
  private currentSpawnDelay: number = 1000;

  private junkItems = ['beer', 'burger', 'chocolate-bar', 'cookie', 'fried-chicken'];
  private goodItems = ['petfood-good', 'fish-good'];

  constructor() {
    super({ key: 'AvoidTheJunkScene' });
  }

  init(data: { petSprite: string, musicVolume?: number, isMuted?: boolean, highScore?: number }) {
    if (data.petSprite) {
      this.petSpritePath = `assets/${data.petSprite}`;
    }
    if (data.musicVolume !== undefined) {
      this.musicVolume = data.musicVolume;
    }
    if (data.isMuted !== undefined) {
      this.startMuted = data.isMuted;
    }
    if (data.highScore !== undefined) {
      this.loadedHighScore = data.highScore;
    }
    this.score = 0;
    this.isGameOver = false;
    this.spawnTimerCount = 0;
    this.currentSpawnDelay = 1000;
  }

  preload() {
    this.load.spritesheet('pet', '/' + this.petSpritePath, {
      frameWidth: 32,
      frameHeight: 32
    });
    
    this.junkItems.forEach(item => {
      this.load.image(item, `/assets/minigames/avoid-the-junk/${item}.png`);
    });

    this.goodItems.forEach(item => {
      this.load.image(item, `/assets/minigames/avoid-the-junk/${item}.png`);
    });

    // Load background music from Supabase
    this.load.audio('bg_music', 'https://awntqvnovwpwyxiqexfr.supabase.co/storage/v1/object/public/mypetpal-music/mini-game-music-1.ogg');
  }

  public toggleMute(muted: boolean) {
    const soundManager = this.sound as any;
    if (soundManager) {
      soundManager.mute = muted;
    }

    const music = (this as any).bgMusic as Phaser.Sound.BaseSound;
    if (music) {
      if (muted) {
        music.pause();
        (music as any).volume = 0;
      } else {
        (music as any).volume = this.musicVolume;
        if (!music.isPlaying) {
          music.play();
        }
      }
    }
  }

  create() {
    this.gameWidth = this.cameras.main.width;
    this.gameHeight = this.cameras.main.height;

    this.add.rectangle(0, 0, this.gameWidth, this.gameHeight, 0x0f172a).setOrigin(0);
    
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x1e293b, 0.4);
    for (let i = 0; i < this.gameWidth; i += 60) {
      graphics.lineBetween(i, 0, i, this.gameHeight);
    }
    for (let i = 0; i < this.gameHeight; i += 60) {
      graphics.lineBetween(0, i, this.gameWidth, i);
    }

    // Apply nearest neighbor filtering to all textures for pixel-perfect scaling
    ['pet', ...this.junkItems, ...this.goodItems].forEach(key => {
      const tex = this.textures.get(key);
      if (tex) {
        tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    });

    // Pet
    this.pet = this.physics.add.sprite(this.gameWidth / 2, this.gameHeight / 2, 'pet', 0);
    this.pet.setCollideWorldBounds(true);
    this.pet.setScale(3);
    this.pet.setDepth(15);
    
    // Forgiving hitbox for pet (decreased by 5%)
    // Original radius was roughly 10-12, now set to a tight 8px
    this.pet.setCircle(8, 8, 8);

    this.anims.create({
      key: 'pet_walk',
      frames: this.anims.generateFrameNumbers('pet', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1
    });
    this.pet.play('pet_walk');

    // Groups
    this.junkGroup = this.physics.add.group();
    this.goodFoodGroup = this.physics.add.group();

    // UI
    this.scoreText = this.add.text(20, 20, 'Score: 0', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: '"Press Start 2P"',
      stroke: '#000000',
      strokeThickness: 4
    }).setDepth(100);

    // Collisions
    this.physics.add.overlap(this.pet, this.junkGroup, this.handleGameOver, undefined, this);
    this.physics.add.overlap(this.pet, this.goodFoodGroup, this.handleCollectGoodFood, undefined, this);

    // Sound management
    const music = this.sound.add('bg_music', { 
      loop: true, 
      volume: this.startMuted ? 0 : this.musicVolume 
    });
    
    // Set initial mute state from preferences
    const soundManager = this.sound as any;
    if (this.startMuted) {
      soundManager.mute = true;
    }
    
    // Store music reference for toggleMute
    (this as any).bgMusic = music;

    const resumeAudio = () => {
      if (soundManager.context && soundManager.context.state === 'suspended') {
        soundManager.context.resume();
      }
      
      if (!music.isPlaying && !this.startMuted && !soundManager.mute) {
        music.play();
      }
      this.input.off('pointerdown', resumeAudio);
    };

    if (soundManager.context && soundManager.context.state === 'suspended') {
      this.input.once('pointerdown', resumeAudio);
    } else if (!this.startMuted && !soundManager.mute) {
      music.play();
    }

    // Stop music ONLY on scene shutdown (closing the game)
    this.events.on('shutdown', () => {
        this.sound.stopAll();
    });

    const instr = this.add.text(this.gameWidth / 2, this.gameHeight - 40, 'DODGE JUNK | DRAG OR TAP TO MOVE', {
      fontSize: '12px',
      color: '#94a3b8',
      fontFamily: '"Press Start 2P"'
    }).setOrigin(0.5).setDepth(100);
    
    this.time.delayedCall(4000, () => {
      this.tweens.add({
        targets: instr,
        alpha: 0,
        duration: 1000
      });
    });
  }

  override update(time: number, delta: number) {
    if (this.isGameOver || !this.pet) return;

    const pointer = this.input.activePointer;
    
    if (this.pet && (pointer.isDown || pointer.active)) {
      // Check if pointer is valid (not 0,0 which is default sometimes)
      if (pointer.x > 0 || pointer.y > 0) {
        const distance = Phaser.Math.Distance.Between(this.pet.x, this.pet.y, pointer.x, pointer.y);
        
        // If distant, move faster (catch up)
        // If close, move precisely
        const followSpeed = distance > 100 ? 600 : 500;

        if (distance > 10) {
          this.physics.moveToObject(this.pet, pointer, followSpeed);
          
          if (pointer.x < this.pet.x) {
            this.pet.setFlipX(true);
          } else {
            this.pet.setFlipX(false);
          }
        } else {
          this.pet.setVelocity(0, 0);
        }
      }
    } else if (this.pet) {
      this.pet.setVelocity(0, 0);
    }

    [...this.junkGroup!.getChildren()].forEach((child: any) => {
      if (child.x < -100 || child.x > this.gameWidth + 100 || child.y < -100 || child.y > this.gameHeight + 100) {
        child.destroy();
        if (!this.isGameOver) {
          // Reduced survival score from +10 to +3
          this.score += 3;
          this.scoreText?.setText(`Score: ${this.score}`);
        }
      }
    });

    this.spawnTimerCount += delta;
    if (this.spawnTimerCount >= this.currentSpawnDelay) {
      this.spawnItem();
      this.spawnTimerCount = 0;
      this.currentSpawnDelay = Math.max(250, 1000 - Math.min(750, Math.floor(this.score / 200) * 30));
    }
  }

  private spawnItem() {
    if (this.isGameOver) return;

    const side = Phaser.Math.Between(0, 3);
    let x, y, vx, vy;
    
    const speed = 150 + Math.min(300, Math.floor(this.score / 250) * 20);

    switch (side) {
      case 0: x = Phaser.Math.Between(0, this.gameWidth); y = -50; vx = Phaser.Math.Between(-60, 60); vy = speed; break;
      case 1: x = this.gameWidth + 50; y = Phaser.Math.Between(0, this.gameHeight); vx = -speed; vy = Phaser.Math.Between(-60, 60); break;
      case 2: x = Phaser.Math.Between(0, this.gameWidth); y = this.gameHeight + 50; vx = Phaser.Math.Between(-60, 60); vy = -speed; break;
      default: x = -50; y = Phaser.Math.Between(0, this.gameHeight); vx = speed; vy = Phaser.Math.Between(-60, 60); break;
    }

    const isFish = Phaser.Math.Between(1, 10) > 8;
    const texture = isFish 
      ? Phaser.Utils.Array.GetRandom(this.goodItems)
      : Phaser.Utils.Array.GetRandom(this.junkItems);
    
    const group = isFish ? this.goodFoodGroup! : this.junkGroup!;
    const item = group.create(x, y, texture);
    item.setData('isJunk', !isFish);
    
    const visualSize = 52;
    const scale = visualSize / Math.max(item.width, item.height);
    item.setScale(scale);
    
    // Forgiving collision bounds (decrease by 5%)
    // The items are roughly circular. Radius is item.width * scale / 2
    const radius = (item.width * scale / 2) * 0.95;
    item.setCircle(radius / scale, (item.width / 2) - (radius / scale), (item.height / 2) - (radius / scale));
    
    item.setVelocity(vx, vy);
    item.setAngularVelocity(Phaser.Math.Between(-100, 100));

    if (isFish) {
      item.setTint(0x4ade80);
      this.tweens.add({
        targets: item,
        scale: scale * 1.25,
        duration: 250,
        yoyo: true,
        repeat: -1
      });
    }
  }

  private handleCollectGoodFood(pet: any, food: any) {
    food.destroy();
    const scoreGain = 100;
    this.score += scoreGain;
    this.scoreText?.setText(`Score: ${this.score}`);

    const txt = this.add.text(food.x, food.y, `+${scoreGain} Score`, {
      fontSize: '28px',
      color: '#4ade80',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(150);
    
    this.tweens.add({
      targets: txt,
      y: txt.y - 100,
      alpha: 0,
      duration: 1000,
      onComplete: () => txt.destroy()
    });

    this.pet?.setTint(0x4ade80);
    this.time.delayedCall(200, () => this.pet?.clearTint());
  }

  private handleGameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.physics.pause();
    this.pet?.setTint(0xff4444);

    const bg = this.add.rectangle(this.gameWidth / 2, this.gameHeight / 2, this.gameWidth, this.gameHeight, 0x000000, 0.85);
    bg.setDepth(200);

    const finalExp = Math.floor(this.score / 100) * 2;

    // High score logic (from DB)
    const previousHigh = this.loadedHighScore;
    const isNewHighScore = this.score > previousHigh;
    const highScore = Math.max(this.score, previousHigh);
    
    if (isNewHighScore) {
      this.loadedHighScore = this.score; // update local ref
      this.events.emit('save-high-score', { score: this.score });
    }

    let yPos = this.gameHeight / 2 - 120;

    this.add.text(this.gameWidth / 2, yPos, 'GAME OVER', {
      fontSize: '42px',
      color: '#ef4444',
      fontFamily: '"Press Start 2P"',
      stroke: '#000000',
      strokeThickness: 8
    }).setOrigin(0.5).setDepth(201);

    yPos += 80;

    this.add.text(this.gameWidth / 2, yPos, `Score: ${this.score}`, {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: '"Press Start 2P"'
    }).setOrigin(0.5).setDepth(201);

    yPos += 45;

    if (isNewHighScore) {
      const newHiText = this.add.text(this.gameWidth / 2, yPos, '★ NEW HIGH SCORE! ★', {
        fontSize: '14px',
        color: '#fbbf24',
        fontFamily: '"Press Start 2P"',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5).setDepth(201);

      this.tweens.add({
        targets: newHiText,
        scale: 1.15,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    } else {
      this.add.text(this.gameWidth / 2, yPos, `Best: ${highScore}`, {
        fontSize: '12px',
        color: '#94a3b8',
        fontFamily: '"Press Start 2P"'
      }).setOrigin(0.5).setDepth(201);
    }

    yPos += 50;

    this.add.text(this.gameWidth / 2, yPos, `EXP EARNED: ${finalExp}`, {
      fontSize: '20px',
      color: '#10b981',
      fontFamily: '"Press Start 2P"',
      stroke: '#000000',
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(201);

    yPos += 80;

    const restartBtn = this.add.text(this.gameWidth / 2, yPos, 'PLAY AGAIN', {
      fontSize: '28px',
      color: '#ffffff',
      backgroundColor: '#3b82f6',
      padding: { x: 30, y: 15 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(201);

    restartBtn.on('pointerdown', () => this.scene.restart());

    yPos += 80;

    const closeBtn = this.add.text(this.gameWidth / 2, yPos, 'EXIT GAME', {
      fontSize: '20px',
      color: '#94a3b8'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(201);

    closeBtn.on('pointerdown', () => {
      this.events.emit('game-exit', { score: this.score, exp: finalExp });
    });
  }
}
