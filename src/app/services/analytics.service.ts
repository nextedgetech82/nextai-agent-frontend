import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError, timeout, catchError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AnalyticsResponse } from '../models/analytics-response';
import { QueryRequest } from '../models/query-request';

export interface ChatSessionApiMessage {
  id?: string | number;
  role?: string;
  type?: string;
  sender?: string;
  message_type?: string;
  content?: string;
  message?: string;
  query?: string;
  query_text?: string;
  prompt?: string;
  user_query?: string;
  response?: string;
  answer?: string;
  sqlQuery?: string;
  sql_query?: string;
  insights?: string;
  data?: any[];
  data_json?: string | any[];
  rows?: any[];
  results?: any[];
  table_data?: any[];
  response_data?: any[];
  analytics_data?: any[];
  analytics_response?: {
    data?: any[];
    sqlQuery?: string;
    sql_query?: string;
    insights?: string;
    chart?: any;
    chartConfig?: any;
    chart_config?: any;
  };
  chart?: any;
  chartConfig?: any;
  chart_config?: any;
  isError?: boolean;
  is_error?: boolean;
  createdAt?: string;
  created_at?: string;
  timestamp?: string;
}

export interface ChatSessionApiItem {
  id?: string | number;
  session_id?: string;
  title?: string;
  session_title?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  is_active?: boolean;
  total_messages?: number;
  total_tokens_used?: number;
  messages?: ChatSessionApiMessage[];
  chat_history?: ChatSessionApiMessage[];
  history?: ChatSessionApiMessage[];
  session_messages?: ChatSessionApiMessage[];
}

export interface ChatSessionListResponse {
  success?: boolean;
  sessions?: ChatSessionApiItem[];
  data?: ChatSessionApiItem[];
  items?: ChatSessionApiItem[];
}

export interface ChatSessionResponse {
  success?: boolean;
  session?: ChatSessionApiItem;
  data?: ChatSessionApiItem;
  id?: string | number;
  session_id?: string;
  title?: string;
  session_title?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  messages?: ChatSessionApiMessage[];
  chat_history?: ChatSessionApiMessage[];
  history?: ChatSessionApiMessage[];
  session_messages?: ChatSessionApiMessage[];
}

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private apiUrl = environment.apiUrl;
  private analyticsTimeoutMs = environment.analyticsTimeoutMs ?? 120000;
  private chatApiUrl = `${environment.apiUrl}/v3/chat`;

  constructor(private http: HttpClient) {}

  processQuery(request: QueryRequest, sessionId?: string): Observable<AnalyticsResponse> {
    const headers = sessionId ? new HttpHeaders({ 'x-session-id': sessionId }) : undefined;

    return this.http
      .post<AnalyticsResponse>(`${this.apiUrl}/multi-customer/analytics`, request, { headers })
      .pipe(timeout(this.analyticsTimeoutMs), catchError(this.handleError));
  }

  listChatSessions(limit?: number, offset?: number): Observable<ChatSessionListResponse> {
    let params = new HttpParams();
    if (limit != null) {
      params = params.set('limit', String(limit));
    }
    if (offset != null) {
      params = params.set('offset', String(offset));
    }

    return this.http
      .get<ChatSessionListResponse>(`${this.chatApiUrl}/sessions`, { params })
      .pipe(timeout(15000), catchError(this.handleError));
  }

  getChatSession(sessionId: string): Observable<ChatSessionResponse> {
    return this.http
      .get<ChatSessionResponse>(`${this.chatApiUrl}/sessions/${sessionId}`)
      .pipe(timeout(15000), catchError(this.handleError));
  }

  createChatSession(title?: string): Observable<ChatSessionResponse> {
    const body = title ? { title } : {};
    return this.http
      .post<ChatSessionResponse>(`${this.chatApiUrl}/sessions`, body)
      .pipe(timeout(15000), catchError(this.handleError));
  }

  deleteChatSession(sessionId: string): Observable<unknown> {
    return this.http
      .delete(`${this.chatApiUrl}/sessions/${sessionId}`)
      .pipe(timeout(15000), catchError(this.handleError));
  }

  clearChatSessions(): Observable<unknown> {
    return this.http
      .delete(`${this.chatApiUrl}/sessions`)
      .pipe(timeout(15000), catchError(this.handleError));
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

  private handleError = (error: HttpErrorResponse | Error) => {
    let errorMessage = 'An error occurred while processing your request';

    if (error instanceof HttpErrorResponse && error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else if (error.name === 'TimeoutError') {
      errorMessage = 'The analytics request took too long. Please try again in a moment.';
    } else if (error instanceof HttpErrorResponse) {
      errorMessage = this.extractHttpErrorMessage(error);
    } else {
      errorMessage = error.message;
    }

    console.error('API Error:', error);
    return throwError(() => new Error(errorMessage));
  };

  private extractHttpErrorMessage(error: HttpErrorResponse): string {
    const errorBody: unknown = error.error;

    if (typeof errorBody === 'string') {
      const parsedHtmlMessage = this.extractHtmlErrorMessage(errorBody);
      if (parsedHtmlMessage) {
        return parsedHtmlMessage;
      }
    }

    if (typeof errorBody === 'object' && errorBody !== null) {
      const body = errorBody as Record<string, unknown>;
      const message =
        this.asReadableString(body['message']) ||
        this.asReadableString(body['error']) ||
        this.asReadableString(body['details']) ||
        this.asReadableString(body['stack']);

      if (message) {
        return message;
      }

      try {
        return JSON.stringify(errorBody);
      } catch {}
    }

    return error.message || 'An error occurred while processing your request';
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

  private asReadableString(value: unknown): string | null {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed || null;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return null;
  }
}
