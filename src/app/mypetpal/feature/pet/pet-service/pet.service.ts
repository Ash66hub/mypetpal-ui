import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../../../environments/environment';
import { Pet } from '../pet';
import { lastValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PetService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  public async getUserPet(userId: string): Promise<Pet | null> {
    const identifier = userId || localStorage.getItem('userPublicId') || '';
    const usePublicId = identifier.length > 0 && !/^\d+$/.test(identifier);
    const url = usePublicId
      ? `${this.apiUrl}Pets?userPublicId=${identifier}`
      : `${this.apiUrl}Pets?userId=${identifier}`;

    try {
      const result = await lastValueFrom(this.http.get<Pet | Pet[]>(url));
      if (Array.isArray(result)) {
        return result.length > 0 ? result[0] : null;
      }
      return result || null;
    } catch (error: any) {
      if (error && error.name === 'EmptyError') {
        return null;
      }
      console.error(`Error fetching pet for UserID: ${userId}`, error);
      throw error;
    }
  }

  public createPet(pet: Pet, userId: string): Promise<Pet> {
    const identifier = userId || localStorage.getItem('userPublicId') || '';
    const usePublicId = identifier.length > 0 && !/^\d+$/.test(identifier);
    const url = usePublicId
      ? `${this.apiUrl}Pets?userPublicId=${identifier}`
      : `${this.apiUrl}Pets?userId=${identifier}`;
    return lastValueFrom(this.http.post<Pet>(url, pet));
  }
}
