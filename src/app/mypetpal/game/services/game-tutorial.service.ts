import { Injectable } from '@angular/core';

export interface TutorialStep {
  target: 'pet' | 'decor' | 'friends';
  title: string;
  messageDesktop: string;
  messageMobile: string;
}

@Injectable({
  providedIn: 'root'
})
export class GameTutorialService {
  private readonly tutorialSteps: readonly TutorialStep[] = [
    {
      target: 'pet',
      title: 'Move Your Pet',
      messageDesktop:
        'Use the direction controls around your pet, or use your keyboard arrow keys to move.',
      messageMobile:
        'Tap the floor to guide your pet around your space. On touch devices, use two fingers to move the room and pinch to zoom.'
    },
    {
      target: 'decor',
      title: 'Customize Your Space',
      messageDesktop:
        'This is the Decor panel. Drag building assets onto the floor to customize your pet paradise and divide your space into rooms.',
      messageMobile:
        'This is the Decor panel. Drag and drop building assets onto the floor to customize your pet paradise and divide your space into rooms.'
    },
    {
      target: 'friends',
      title: 'Meet Pet Pals',
      messageDesktop:
        'Use the Neighborhood panel to add pet pals, visit their spaces, or invite them over to hang out in your space.',
      messageMobile:
        'Use the Neighborhood panel to add pet pals, visit their spaces, or invite them over to hang out in your space.'
    }
  ];

  public getStepCount(): number {
    return this.tutorialSteps.length;
  }

  public getStep(index: number): TutorialStep | null {
    return this.tutorialSteps[index] ?? null;
  }

  public isLastStep(index: number): boolean {
    return index >= this.tutorialSteps.length - 1;
  }

  public getStepMessage(step: TutorialStep, isMobileViewport: boolean): string {
    return isMobileViewport ? step.messageMobile : step.messageDesktop;
  }

  public getHiddenSpotStyles(): Record<string, Record<string, string>> {
    return {
      pet: { display: 'none' },
      decor: { display: 'none' },
      friends: { display: 'none' }
    };
  }

  public getPetSpotStyle(
    wrapper: HTMLElement | null,
    target: HTMLElement | null
  ): Record<string, string> {
    if (!wrapper || !target) {
      return { display: 'none' };
    }

    const wrapperRect = wrapper.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    const width = targetRect.width * 0.4;
    const height = targetRect.height * 0.38;
    const left =
      targetRect.left - wrapperRect.left + (targetRect.width - width) / 2;
    const top =
      targetRect.top - wrapperRect.top + (targetRect.height - height) / 2 - 4;

    const clamped = this.clampRectToWrapper(wrapperRect, {
      left,
      top,
      width: Math.max(72, width),
      height: Math.max(72, height)
    });

    return {
      left: `${clamped.left}px`,
      top: `${clamped.top}px`,
      width: `${clamped.width}px`,
      height: `${clamped.height}px`
    };
  }

  public getElementSpotStyle(
    wrapper: HTMLElement | null,
    target: HTMLElement | null,
    padding: number
  ): Record<string, string> {
    if (!wrapper || !target) {
      return { display: 'none' };
    }

    const wrapperRect = wrapper.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    const inset = Math.max(2, Math.floor(padding / 2));
    const left = targetRect.left - wrapperRect.left - inset;
    const top = targetRect.top - wrapperRect.top - inset;
    const width = targetRect.width + inset * 2;
    const height = targetRect.height + inset * 2;

    const clamped = this.clampRectToWrapper(wrapperRect, {
      left,
      top,
      width: Math.max(24, width),
      height: Math.max(24, height)
    });

    return {
      left: `${clamped.left}px`,
      top: `${clamped.top}px`,
      width: `${clamped.width}px`,
      height: `${clamped.height}px`
    };
  }

  private clampRectToWrapper(
    wrapperRect: DOMRect,
    rect: { left: number; top: number; width: number; height: number }
  ): { left: number; top: number; width: number; height: number } {
    const maxWidth = Math.max(24, wrapperRect.width);
    const maxHeight = Math.max(24, wrapperRect.height);

    const width = Math.min(rect.width, maxWidth);
    const height = Math.min(rect.height, maxHeight);

    const left = Math.min(Math.max(0, rect.left), Math.max(0, maxWidth - width));
    const top = Math.min(Math.max(0, rect.top), Math.max(0, maxHeight - height));

    return { left, top, width, height };
  }
}
