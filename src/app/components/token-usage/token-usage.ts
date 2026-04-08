import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  DailyUsage,
  PurchaseHistoryItem,
  PurchaseHistoryResponse,
  RecentQuery,
  TokenUsageService,
  TokenUsageResponse,
  TokenLimits,
  UsageSummary,
} from '../../services/token-usage.service';

interface UsageBreakdownItem {
  color: string;
  label: string;
  percentage: number;
  value: number;
}

interface DailyUsageChartItem {
  dateLabel: string;
  queries: number;
  queryPercentage: number;
  tokens: number;
  tokenPercentage: number;
}

@Component({
  selector: 'app-token-usage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './token-usage.html',
  styleUrls: ['./token-usage.css'],
})
export class TokenUsageComponent implements OnInit {
  usageData: TokenUsageResponse | null = null;
  loading = false;
  error: string | null = null;
  showRecentQueries = true;
  showPurchaseHistory = true;
  usageBreakdown: UsageBreakdownItem[] = [];
  dailyUsageChart: DailyUsageChartItem[] = [];
  purchaseHistory: PurchaseHistoryItem[] = [];
  purchaseHistoryLoading = false;
  purchaseHistoryError: string | null = null;
  recentQueryFilters = {
    query: '',
    sql: '',
    tokens: '',
    time: '',
    accuracy: '',
    date: '',
  };

  colors = {
    primary: '#0d6efd',
    success: '#198754',
    warning: '#ffc107',
    danger: '#dc3545',
    info: '#0dcaf0',
  };

  constructor(
    private tokenUsageService: TokenUsageService,
    private router: Router,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadUsageStats();
  }

  goToChat(): void {
    void this.router.navigate(['/chat']);
  }

  loadUsageStats(): void {
    this.loading = true;
    this.error = null;

    this.tokenUsageService.getTokenUsageStats().subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          try {
            this.usageData = this.normalizeUsageResponse(response as Partial<TokenUsageResponse>);
            this.buildUsageBreakdown();
            this.buildDailyUsageChart();
          } catch (error) {
            console.error('Failed to normalize usage stats response', error);
            this.error = 'Usage data was received, but the response format is invalid.';
          } finally {
            this.loading = false;
            this.cdr.detectChanges();
          }
        });
      },
      error: (error) => {
        this.ngZone.run(() => {
          this.error = error.message || 'Failed to load usage statistics';
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
    });

    this.loadPurchaseHistory();
  }

  loadPurchaseHistory(): void {
    this.purchaseHistoryLoading = true;
    this.purchaseHistoryError = null;

    this.tokenUsageService.getPurchaseHistory().subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          try {
            this.purchaseHistory = this.normalizePurchaseHistoryResponse(response as Partial<PurchaseHistoryResponse>);
          } catch (error) {
            console.error('Failed to normalize purchase history response', error);
            this.purchaseHistory = [];
            this.purchaseHistoryError = 'Purchase history was received, but the response format is invalid.';
          } finally {
            this.purchaseHistoryLoading = false;
            this.cdr.detectChanges();
          }
        });
      },
      error: (error) => {
        this.ngZone.run(() => {
          this.purchaseHistory = [];
          this.purchaseHistoryError = error.message || 'Failed to load purchase history';
          this.purchaseHistoryLoading = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  private normalizeUsageResponse(response: Partial<TokenUsageResponse>): TokenUsageResponse {
    const tokenLimits = response.token_limits ?? ({} as Partial<TokenLimits>);
    const tokenBalance = response.token_balance ?? {};
    const usageSummary =
      response.usage_summary ?? response.statistics ?? ({} as Partial<UsageSummary>);
    const totalPurchased = Number(
      response.total_tokens_purchased ??
        response.totalPurchased ??
        tokenBalance.total_tokens_purchased ??
        tokenLimits.total_tokens_purchased ??
        tokenLimits.monthly_limit ??
        0,
    );
    const totalUsed = Number(
      response.total_tokens_used ??
        response.totalUsed ??
        tokenBalance.total_tokens_used ??
        tokenLimits.total_tokens_used ??
        tokenLimits.used_this_month ??
        0,
    );
    const remainingBalance = Number(
      response.remaining_balance ??
        response.remainingBalance ??
        tokenBalance.remaining_balance ??
        tokenLimits.remaining_balance ??
        tokenLimits.balance_tokens ??
        0,
    );

    return {
      success: Boolean(response.success),
      customer_id: response.customer_id ?? '',
      token_limits: {
        total_tokens_purchased: totalPurchased,
        total_tokens_used: totalUsed,
        remaining_balance: remainingBalance,
        monthly_limit: Number(tokenLimits.monthly_limit ?? totalPurchased),
        used_this_month: Number(tokenLimits.used_this_month ?? totalUsed),
        balance_tokens: Number(tokenLimits.balance_tokens ?? remainingBalance),
        usage_percent: Number(
          tokenLimits.usage_percent ?? tokenBalance.usage_percentage ?? tokenLimits.usage_percentage ?? 0,
        ),
        usage_percentage: Number(
          tokenLimits.usage_percentage ?? tokenBalance.usage_percentage ?? tokenLimits.usage_percent ?? 0,
        ),
      },
      token_balance: tokenBalance,
      total_tokens_purchased: totalPurchased,
      total_tokens_used: totalUsed,
      remaining_balance: remainingBalance,
      totalPurchased,
      totalUsed,
      remainingBalance,
      usage_summary: {
        total_queries: Number(usageSummary.total_queries ?? 0),
        total_tokens_actual: Number(usageSummary.total_tokens_actual ?? 0),
        total_cost_actual: Number(usageSummary.total_cost_actual ?? 0),
        avg_accuracy: Number(usageSummary.avg_accuracy ?? 0),
        avg_processing_time: Number(usageSummary.avg_processing_time ?? 0),
        total_tokens_estimated: Number(usageSummary.total_tokens_estimated ?? 0),
        total_cost_estimated: Number(usageSummary.total_cost_estimated ?? 0),
        first_query_date: usageSummary.first_query_date ?? '',
        last_query_date: usageSummary.last_query_date ?? '',
      },
      statistics: {
        total_queries: Number(usageSummary.total_queries ?? 0),
        total_tokens_actual: Number(usageSummary.total_tokens_actual ?? 0),
        total_cost_actual: Number(usageSummary.total_cost_actual ?? 0),
        avg_accuracy: Number(usageSummary.avg_accuracy ?? 0),
        avg_processing_time: Number(usageSummary.avg_processing_time ?? 0),
        total_tokens_estimated: Number(usageSummary.total_tokens_estimated ?? 0),
        total_cost_estimated: Number(usageSummary.total_cost_estimated ?? 0),
        first_query_date: usageSummary.first_query_date ?? '',
        last_query_date: usageSummary.last_query_date ?? '',
      },
      daily_usage: (response.daily_usage ?? []).map((entry) => this.normalizeDailyUsage(entry)),
      recent_queries: (response.recent_queries ?? []).map((entry) =>
        this.normalizeRecentQuery(entry),
      ),
      reset_action: response.reset_action
        ? {
            can_reset: Boolean(response.reset_action.can_reset),
            reset_endpoint: response.reset_action.reset_endpoint ?? '',
          }
        : undefined,
    };
  }

  private normalizeDailyUsage(entry: Partial<DailyUsage>): DailyUsage {
    return {
      date: entry.date ?? '',
      query_count: Number(entry.query_count ?? 0),
      tokens_used: Number(entry.tokens_used ?? 0),
      cost: Number(entry.cost ?? 0),
    };
  }

  private normalizePurchaseHistoryResponse(response: Partial<PurchaseHistoryResponse>): PurchaseHistoryItem[] {
    const rows = response.purchase_history ?? response.purchases ?? response.data ?? [];
    return rows.map((entry) => this.normalizePurchaseHistoryItem(entry));
  }

  private normalizePurchaseHistoryItem(
    entry: Partial<PurchaseHistoryItem> & {
      batchId?: string;
      purchaseDate?: string;
      expiryDate?: string;
      tokens_purchased?: number;
      token_count?: number;
      amount?: number;
      total_amount?: number;
      remaining_balance?: number;
      tokens_remaining?: number;
      remaining_tokens_in_batch?: number;
      referenceNo?: string;
    },
  ): PurchaseHistoryItem {
    return {
      id: Number(entry.id ?? 0),
      customer_id: entry.customer_id ?? '',
      batch_id: entry.batch_id ?? entry.batchId ?? '',
      purchase_date: entry.purchase_date ?? entry.purchaseDate ?? '',
      expiry_date: entry.expiry_date ?? entry.expiryDate ?? '',
      status: entry.status ?? '',
      tokens_allocated: Number(entry.tokens_allocated ?? entry.tokens_purchased ?? entry.token_count ?? 0),
      purchase_amount: Number(entry.purchase_amount ?? entry.amount ?? entry.total_amount ?? 0),
      tokens_remaining: Number(
        entry.tokens_remaining ?? entry.remaining_balance ?? entry.remaining_tokens_in_batch ?? 0,
      ),
      reference_no: entry.reference_no ?? entry.referenceNo ?? '',
    };
  }

  private normalizeRecentQuery(
    entry: Partial<RecentQuery> & { cost?: number; tokens_used?: number; sqlQuery?: string },
  ): RecentQuery {
    return {
      id: Number(entry.id ?? 0),
      query_text: entry.query_text ?? '',
      sql_query: entry.sql_query ?? entry.sqlQuery ?? '',
      tokens_used_actual: Number(entry.tokens_used_actual ?? entry.tokens_used ?? 0),
      cost_actual: Number(entry.cost_actual ?? entry.cost ?? 0),
      processing_time_ms: Number(entry.processing_time_ms ?? 0),
      query_timestamp: entry.query_timestamp ?? '',
      token_accuracy_percent: Number(entry.token_accuracy_percent ?? 0),
    };
  }

  private buildUsageBreakdown(): void {
    if (!this.usageData) {
      this.usageBreakdown = [];
      return;
    }

    const purchased = this.totalTokensPurchased;
    const used = this.totalTokensUsed;
    const remaining = this.remainingTokens;

    this.usageBreakdown = [
      {
        label: 'Token Purchased',
        value: purchased,
        percentage: purchased > 0 ? 100 : 0,
        color: this.colors.info,
      },
      {
        label: 'Token Used',
        value: used,
        percentage: purchased > 0 ? (used / purchased) * 100 : 0,
        color: this.colors.primary,
      },
      {
        label: 'Remaining Tokens',
        value: remaining,
        percentage: purchased > 0 ? (remaining / purchased) * 100 : 0,
        color: this.colors.success,
      },
    ];
  }

  buildDailyUsageChart(): void {
    if (!this.usageData?.daily_usage?.length) {
      this.dailyUsageChart = [];
      return;
    }

    const dailyData = [...this.usageData.daily_usage].reverse();
    const maxTokens = Math.max(...dailyData.map((d) => d.tokens_used), 1);
    const maxQueries = Math.max(...dailyData.map((d) => d.query_count), 1);

    this.dailyUsageChart = dailyData.map((entry) => ({
      dateLabel: new Date(entry.date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
      }),
      tokens: entry.tokens_used,
      tokenPercentage: (entry.tokens_used / maxTokens) * 100,
      queries: entry.query_count,
      queryPercentage: (entry.query_count / maxQueries) * 100,
    }));
  }

  formatNumber(num: number): string {
    return num.toLocaleString('en-IN');
  }

  formatCurrency(num: number): string {
    return `₹${num.toFixed(2)}`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  }

  getProgressBarColor(percentage: number): string {
    if (percentage < 50) return this.colors.success;
    if (percentage < 80) return this.colors.warning;
    return this.colors.danger;
  }

  get usageGaugeStyle(): string {
    const usedPercentage = this.usagePercent;
    return `conic-gradient(${this.colors.primary} 0 ${usedPercentage}%, ${this.colors.success} ${usedPercentage}% 100%)`;
  }

  get totalTokensPurchased(): number {
    return (
      this.usageData?.total_tokens_purchased ??
      this.usageData?.totalPurchased ??
      this.usageData?.token_limits.total_tokens_purchased ??
      this.usageData?.token_limits.monthly_limit ??
      0
    );
  }

  get totalTokensUsed(): number {
    return (
      this.usageData?.total_tokens_used ??
      this.usageData?.totalUsed ??
      this.usageData?.token_limits.total_tokens_used ??
      this.usageData?.token_limits.used_this_month ??
      0
    );
  }

  get remainingTokens(): number {
    return (
      this.usageData?.remaining_balance ??
      this.usageData?.remainingBalance ??
      this.usageData?.token_limits.remaining_balance ??
      this.usageData?.token_limits.balance_tokens ??
      0
    );
  }

  get usagePercent(): number {
    const explicitPercent =
      this.usageData?.token_limits.usage_percent ?? this.usageData?.token_limits.usage_percentage;

    if (typeof explicitPercent === 'number' && explicitPercent > 0) {
      return explicitPercent;
    }

    const purchased = this.totalTokensPurchased;
    if (purchased <= 0) {
      return 0;
    }

    return Math.min(100, Math.round((this.totalTokensUsed / purchased) * 100));
  }

  get usageSummary(): UsageSummary | null {
    return this.usageData?.usage_summary ?? this.usageData?.statistics ?? null;
  }

  getStatusText(percentage: number): string {
    if (percentage < 50) return 'Good';
    if (percentage < 80) return 'Moderate';
    if (percentage < 95) return 'High';
    return 'Critical';
  }

  get filteredRecentQueries(): RecentQuery[] {
    const queries = this.usageData?.recent_queries ?? [];
    const filters = this.recentQueryFilters;

    return queries.filter((query) => {
      return (
        this.matchesFilter(query.query_text, filters.query) &&
        this.matchesFilter(query.sql_query ?? '', filters.sql) &&
        this.matchesFilter(String(query.tokens_used_actual), filters.tokens) &&
        this.matchesFilter(String(query.processing_time_ms), filters.time) &&
        this.matchesFilter(String(query.token_accuracy_percent), filters.accuracy) &&
        this.matchesFilter(this.formatDate(query.query_timestamp), filters.date)
      );
    });
  }

  get filteredRecentQueryTokenSum(): number {
    return this.filteredRecentQueries.reduce((sum, query) => sum + query.tokens_used_actual, 0);
  }

  private matchesFilter(value: string, filterValue: string): boolean {
    if (!filterValue.trim()) {
      return true;
    }

    return value.toLowerCase().includes(filterValue.trim().toLowerCase());
  }
}
