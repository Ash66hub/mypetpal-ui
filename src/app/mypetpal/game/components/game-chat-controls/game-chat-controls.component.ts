import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild
} from '@angular/core';
import { SharedModule } from '../../../../shared/shared.module';

@Component({
  selector: 'app-game-chat-controls',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './game-chat-controls.component.html',
  styleUrls: ['./game-chat-controls.component.scss']
})
export class GameChatControlsComponent {
  @ViewChild('chatInput') chatInput?: ElementRef<HTMLInputElement>;

  @Input() isHomeViewMode = false;
  @Input() roomOwnerId: string | null = null;
  @Input() emojis: string[] = [];

  @Output() returnHome = new EventEmitter<void>();
  @Output() talk = new EventEmitter<string>();
  @Output() inputFocus = new EventEmitter<void>();
  @Output() inputBlur = new EventEmitter<void>();

  public isEmojiPickerOpen = false;
  public messageText = '';

  @HostListener('document:click', ['$event'])
  public onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.emoji-selector-wrapper')) {
      this.isEmojiPickerOpen = false;
    }
  }

  public onReturnHome(): void {
    this.returnHome.emit();
  }

  public onTalk(): void {
    const text = this.messageText;
    this.talk.emit(text);
    this.messageText = '';
  }

  public onInputFocusInternal(): void {
    this.inputFocus.emit();
  }

  public onInputBlurInternal(): void {
    this.inputBlur.emit();
  }

  public onToggleEmojiPicker(event: Event): void {
    event.stopPropagation();
    this.isEmojiPickerOpen = !this.isEmojiPickerOpen;
  }

  public onAddEmoji(emoji: string): void {
    const input = this.chatInput?.nativeElement;
    if (!input) {
      this.messageText += emoji;
      return;
    }

    const start = input.selectionStart ?? this.messageText.length;
    const end = input.selectionEnd ?? this.messageText.length;
    const before = this.messageText.slice(0, start);
    const after = this.messageText.slice(end);

    this.messageText = `${before}${emoji}${after}`;

    queueMicrotask(() => {
      input.focus();
      const nextPos = start + emoji.length;
      input.setSelectionRange(nextPos, nextPos);
    });
  }
}
