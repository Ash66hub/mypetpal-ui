import { TestBed } from '@angular/core/testing';

import { LoginStreamService } from './login-stream.service';

describe('LoginStreamService', () => {
  let service: LoginStreamService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoginStreamService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
