import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LevelBarComponent } from './level-bar.component';

describe('LevelBarComponent', () => {
  let component: LevelBarComponent;
  let fixture: ComponentFixture<LevelBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LevelBarComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(LevelBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
