import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, throwError, timeout } from 'rxjs';
import { environment } from '../../environments/environment';

interface CustomerApiKeyResponse {
  success: boolean;
  customer_id: string;
  api_key: string;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class CustomerAuthService {
  private readonly customerIdStorageKey = 'customer_id';
  private readonly apiKeyStorageKey = 'customer_api_key';
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  requestApiKey(customerId: string): Observable<string> {
    return this.http
      .post<CustomerApiKeyResponse>(`${this.apiUrl}/multi-customer/customer-api-key`, {
        customer_id: customerId,
      })
      .pipe(
        timeout(10000),
        map((response) => {
          if (!response.success || !response.api_key) {
            throw new Error(response.message || 'Customer ID validation failed');
          }

          this.saveCredentials(response.customer_id, response.api_key);
          return response.api_key;
        }),
        catchError(this.handleError),
      );
  }

  saveCredentials(customerId: string, apiKey: string): void {
    localStorage.setItem(this.customerIdStorageKey, customerId);
    localStorage.setItem(this.apiKeyStorageKey, apiKey);
  }

  getCustomerId(): string | null {
    return localStorage.getItem(this.customerIdStorageKey);
  }

  getApiKey(): string | null {
    return localStorage.getItem(this.apiKeyStorageKey);
  }

  isAuthenticated(): boolean {
    return !!this.getApiKey();
  }

  clearCredentials(): void {
    localStorage.removeItem(this.customerIdStorageKey);
    localStorage.removeItem(this.apiKeyStorageKey);
  }

  private handleError(error: HttpErrorResponse | Error) {
    const errorMessage =
      (error as HttpErrorResponse).error?.message ||
      (error as HttpErrorResponse).error?.error ||
      error.message ||
      'Unable to validate customer ID';
    return throwError(() => new Error(errorMessage));
  }
}
