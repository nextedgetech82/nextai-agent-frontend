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
  private readonly directAccessStorageKey = 'direct_access_login';
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  requestApiKey(customerId: string, isDirectAccess: boolean = false): Observable<string> {
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

          this.saveCredentials(response.customer_id, response.api_key, isDirectAccess);
          return response.api_key;
        }),
        catchError(this.handleError),
      );
  }

  saveCredentials(customerId: string, apiKey: string, isDirectAccess: boolean = false): void {
    localStorage.setItem(this.customerIdStorageKey, customerId);
    localStorage.setItem(this.apiKeyStorageKey, apiKey);
    localStorage.setItem(this.directAccessStorageKey, String(isDirectAccess));
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

  isDirectAccessLogin(): boolean {
    return localStorage.getItem(this.directAccessStorageKey) === 'true';
  }

  clearCredentials(): void {
    localStorage.removeItem(this.customerIdStorageKey);
    localStorage.removeItem(this.apiKeyStorageKey);
    localStorage.removeItem(this.directAccessStorageKey);
  }

  private handleError = (error: HttpErrorResponse | Error) => {
    const errorMessage =
      error instanceof HttpErrorResponse
        ? this.extractHttpErrorMessage(error)
        : error.message || 'Unable to validate customer ID';
    return throwError(() => new Error(errorMessage));
  };

  private extractHttpErrorMessage(error: HttpErrorResponse): string {
    const errorBody = error.error;

    if (typeof errorBody === 'string') {
      const parsedHtmlMessage = this.extractHtmlErrorMessage(errorBody);
      if (parsedHtmlMessage) {
        return parsedHtmlMessage;
      }
    }

    if (typeof errorBody === 'object' && errorBody !== null) {
      return errorBody.message || errorBody.error || error.message || 'Unable to validate customer ID';
    }

    return error.message || 'Unable to validate customer ID';
  }

  private extractHtmlErrorMessage(html: string): string | null {
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch?.[1]?.trim();

    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (bodyText) {
      return bodyText.length > 220 ? `${bodyText.slice(0, 217)}...` : bodyText;
    }

    return title || null;
  }
}
