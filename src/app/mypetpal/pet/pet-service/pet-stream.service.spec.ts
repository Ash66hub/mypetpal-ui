import { TestBed } from '@angular/core/testing';

import { PetStreamService } from './pet-stream.service';

describe('PetStreamService', () => {
  let service: PetStreamService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PetStreamService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
