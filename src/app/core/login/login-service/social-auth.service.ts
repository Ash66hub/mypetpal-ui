import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SocialAuthService {
  private readonly supabase: SupabaseClient | null;

  constructor() {
    if (environment.supabaseUrl && environment.supabaseAnonKey) {
      this.supabase = createClient(
        environment.supabaseUrl,
        environment.supabaseAnonKey
      );
      return;
    }

    this.supabase = null;
  }

  public async signInWithGoogle(redirectTo: string): Promise<void> {
    if (!this.supabase) {
      throw new Error(
        'Supabase auth is not configured in environment settings.'
      );
    }

    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    });

    if (error) {
      throw error;
    }
  }

  public async getGoogleAccessTokenFromSession(): Promise<string | null> {
    if (!this.supabase) {
      return null;
    }

    const { data, error } = await this.supabase.auth.getSession();
    if (error) {
      throw error;
    }

    return data.session?.access_token ?? null;
  }

  public async signOut(): Promise<void> {
    if (!this.supabase) {
      return;
    }

    const { error } = await this.supabase.auth.signOut();
    if (error) {
      throw error;
    }
  }
}
