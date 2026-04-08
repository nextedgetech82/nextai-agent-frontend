import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TokenLimits {
  total_tokens_purchased?: number;
  total_tokens_used?: number;
  remaining_balance?: number;
  monthly_limit: number;
  used_this_month: number;
  balance_tokens: number;
  usage_percent?: number;
  usage_percentage?: number;
}

export interface TokenBalance {
  total_tokens_purchased?: number;
  total_tokens_used?: number;
  remaining_balance?: number;
  usage_percentage?: number;
  total_purchase_amount?: number;
  total_batches?: number;
  first_purchase_date?: string;
  last_purchase_date?: string;
  tokens_remaining_in_batches?: number;
}

export interface UsageSummary {
  total_queries: number;
  total_tokens_actual: number;
  total_cost_actual: number;
  avg_accuracy: number;
  avg_processing_time: number;
  total_tokens_estimated?: number;
  total_cost_estimated?: number;
  first_query_date?: string;
  last_query_date?: string;
}

export interface DailyUsage {
  date: string;
  query_count: number;
  tokens_used: number;
  cost: number;
}

export interface RecentQuery {
  id: number;
  query_text: string;
  sql_query?: string;
  tokens_used_actual: number;
  cost_actual: number;
  processing_time_ms: number;
  query_timestamp: string;
  token_accuracy_percent: number;
}

export interface PurchaseHistoryItem {
  id: number;
  customer_id?: string;
  batch_id?: string;
  purchase_date?: string;
  expiry_date?: string;
  status?: string;
  tokens_allocated: number;
  purchase_amount: number;
  tokens_remaining?: number;
  reference_no?: string;
}

export interface PurchaseHistoryResponse {
  success: boolean;
  customer_id: string;
  total_batches?: number;
  purchase_history?: PurchaseHistoryItem[];
  purchases?: PurchaseHistoryItem[];
  data?: PurchaseHistoryItem[];
}

export interface TokenUsageResponse {
  success: boolean;
  customer_id: string;
  token_limits: TokenLimits;
  token_balance?: TokenBalance;
  total_tokens_purchased?: number;
  total_tokens_used?: number;
  remaining_balance?: number;
  totalPurchased?: number;
  totalUsed?: number;
  remainingBalance?: number;
  usage_summary?: UsageSummary;
  statistics?: UsageSummary;
  daily_usage: DailyUsage[];
  recent_queries: RecentQuery[];
  reset_action?: {
    can_reset: boolean;
    reset_endpoint: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class TokenUsageService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getTokenUsageStats(): Observable<TokenUsageResponse> {
    return this.http.get<TokenUsageResponse>(`${this.apiUrl}/multi-customer/usage/stats`);
  }

  getPurchaseHistory(): Observable<PurchaseHistoryResponse> {
    return this.http.get<PurchaseHistoryResponse>(`${this.apiUrl}/multi-customer/purchase/history`);
  }
}
