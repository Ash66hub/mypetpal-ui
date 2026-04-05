import { Injectable } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class HealthService {
  private readonly rawHttp: HttpClient;
  private readonly healthUrl = `${environment.apiUrl}health`;

  constructor(httpBackend: HttpBackend) {
    // Bypass interceptors for health checks so auth refresh logic does not interfere.
    this.rawHttp = new HttpClient(httpBackend);
  }

  public checkServerHealth(): Observable<boolean> {
    return this.rawHttp.get(this.healthUrl, { responseType: 'text' }).pipe(
      timeout({ first: 4000 }),
      map(() => true),
      catchError(() => of(false))
    );
  }
}
