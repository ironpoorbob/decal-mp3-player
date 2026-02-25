import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PlayerDataService {
  private readonly http = inject(HttpClient);

  getJson<T>(url: string): Observable<T> {
    console.log(`Fetching JSON data from: ${url}`);
    return this.http.get<T>(url);
  }
}
