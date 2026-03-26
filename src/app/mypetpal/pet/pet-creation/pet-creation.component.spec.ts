import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PetCreationComponent } from './pet-creation.component';

describe('PetCreationComponent', () => {
  let component: PetCreationComponent;
  let fixture: ComponentFixture<PetCreationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PetCreationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PetCreationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
