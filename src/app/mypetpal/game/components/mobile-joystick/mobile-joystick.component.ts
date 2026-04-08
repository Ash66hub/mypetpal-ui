import {
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';

export interface JoystickEvent {
  direction: string | null;
  intensity: number;
}

@Component({
  selector: 'app-mobile-joystick',
  standalone: true,
  templateUrl: './mobile-joystick.component.html',
  styleUrls: ['./mobile-joystick.component.scss']
})
export class MobileJoystickComponent implements OnInit, OnDestroy {
  @Output() joystickUpdate = new EventEmitter<JoystickEvent>();
  
  @ViewChild('knob', { static: true }) knob!: ElementRef<HTMLDivElement>;
  @ViewChild('base', { static: true }) base!: ElementRef<HTMLDivElement>;
  
  public isActive = false;
  private pointerId: number | null = null;
  private centerX = 0;
  private centerY = 0;
  private maxRadius = 40;
  private currentDirection: string | null = null;
  private currentIntensity = 0;

  ngOnInit(): void {}

  ngOnDestroy(): void {}

  public onPointerDown(event: PointerEvent): void {
    if (this.isActive) return;
    this.isActive = true;
    this.pointerId = event.pointerId;
    this.base.nativeElement.setPointerCapture(event.pointerId);
    
    const rect = this.base.nativeElement.getBoundingClientRect();
    this.centerX = rect.left + rect.width / 2;
    this.centerY = rect.top + rect.height / 2;
    this.maxRadius = (rect.width / 2) - (this.knob.nativeElement.offsetWidth / 2);

    this.handleMove(event.clientX, event.clientY);
  }

  public onPointerMove(event: PointerEvent): void {
    if (!this.isActive || event.pointerId !== this.pointerId) return;
    this.handleMove(event.clientX, event.clientY);
  }

  public onPointerUp(event: PointerEvent): void {
    if (!this.isActive || event.pointerId !== this.pointerId) return;
    
    this.isActive = false;
    this.pointerId = null;
    this.base.nativeElement.releasePointerCapture(event.pointerId);
    
    this.knob.nativeElement.style.transform = `translate(0px, 0px)`;
    
    this.currentDirection = null;
    this.currentIntensity = 0;
    this.emitUpdate();
  }

  private handleMove(x: number, y: number): void {
    const dx = x - this.centerX;
    const dy = y - this.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const angle = Math.atan2(dy, dx);
    const length = Math.min(distance, this.maxRadius);
    const knobX = Math.cos(angle) * length;
    const knobY = Math.sin(angle) * length;
    
    this.knob.nativeElement.style.transform = `translate(${knobX}px, ${knobY}px)`;

    const deg = (angle * 180) / Math.PI;
    const newDirection = distance > 10 ? this.getDirectionFromAngle(deg) : null;
    const newIntensity = length / this.maxRadius;
    
    // We emit if EITHER the 45-deg direction quadrant changed OR the intensity changed significantly
    // (Intensity change of 0.05 is enough for smooth speed ramps without flooding events)
    const intensityChanged = Math.abs(newIntensity - this.currentIntensity) > 0.05;
    
    if (newDirection !== this.currentDirection || intensityChanged) {
      this.currentDirection = newDirection;
      this.currentIntensity = newIntensity;
      this.emitUpdate();
    }
  }

  private emitUpdate(): void {
    this.joystickUpdate.emit({
      direction: this.currentDirection,
      intensity: this.currentIntensity
    });
  }

  private getDirectionFromAngle(deg: number): string {
    const normalized = (deg >= 0 ? deg : 360 + deg);
    const sector = Math.round(normalized / 45);
    
    switch(sector % 8) {
      case 0: return 'right';
      case 1: return 'down-right';
      case 2: return 'down';
      case 3: return 'down-left';
      case 4: return 'left';
      case 5: return 'up-left';
      case 6: return 'up';
      case 7: return 'up-right';
      default: return 'right';
    }
  }
}
