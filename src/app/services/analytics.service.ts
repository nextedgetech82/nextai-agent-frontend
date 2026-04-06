import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, timeout, catchError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AnalyticsResponse } from '../models/analytics-response';
import { QueryRequest } from '../models/query-request';

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private apiUrl = environment.apiUrl;
  private analyticsTimeoutMs = environment.analyticsTimeoutMs ?? 120000;

  constructor(private http: HttpClient) {}

  processQuery(request: QueryRequest): Observable<AnalyticsResponse> {
    return this.http
      .post<AnalyticsResponse>(`${this.apiUrl}/multi-customer/analytics`, request)
      .pipe(timeout(this.analyticsTimeoutMs), catchError(this.handleError));
  }

  getSuggestions(): Observable<{ suggestions: string[] }> {
    return this.http
      .get<{ suggestions: string[] }>(`${this.apiUrl}/analytics/suggestions`)
      .pipe(timeout(5000), catchError(this.handleError));
  }

  getPredefinedAnalytics(type: string): Observable<AnalyticsResponse> {
    return this.http
      .get<AnalyticsResponse>(`${this.apiUrl}/analytics/predefined/${type}`)
      .pipe(timeout(30000), catchError(this.handleError));
  }

  clearCache(): Observable<any> {
    return this.http
      .post(`${this.apiUrl}/admin/cache/clear`, {})
      .pipe(timeout(10000), catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse | Error) {
    let errorMessage = 'An error occurred while processing your request';

    if (error instanceof HttpErrorResponse && error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else if (error.name === 'TimeoutError') {
      errorMessage = 'The analytics request took too long. Please try again in a moment.';
    } else if (error instanceof HttpErrorResponse) {
      errorMessage = error.error?.error || error.message;
    } else {
      errorMessage = error.message;
    }

    console.error('API Error:', error);
    return throwError(() => new Error(errorMessage));
  }
}
