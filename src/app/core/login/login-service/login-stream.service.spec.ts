import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { LoginService } from './login.service';
import { LoginStreamService } from './login-stream.service';

describe('LoginStreamService', () => {
  let service: LoginStreamService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [LoginStreamService, LoginService]
    });
    service = TestBed.inject(LoginStreamService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
