import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Pet } from '../pet';
import { lastValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PetService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  public getUserPet(userId: string): Promise<Pet> {
    const url = `${this.apiUrl}Pets/${userId}`;

    return lastValueFrom(this.http.get<Pet>(url)).catch(error => {
      console.error(`Error fetching pet for UserID: ${userId}`, error);
      throw error;
    });
  }
}
