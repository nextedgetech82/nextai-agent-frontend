import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  DailyUsage,
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
  imports: [CommonModule],
  templateUrl: './token-usage.html',
  styleUrls: ['./token-usage.css'],
})
export class TokenUsageComponent implements OnInit {
  usageData: TokenUsageResponse | null = null;
  loading = false;
  error: string | null = null;
  showRecentQueries = true;
  usageBreakdown: UsageBreakdownItem[] = [];
  dailyUsageChart: DailyUsageChartItem[] = [];

  // Color scheme
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
  }

  private normalizeUsageResponse(response: Partial<TokenUsageResponse>): TokenUsageResponse {
    const tokenLimits = response.token_limits ?? ({} as Partial<TokenLimits>);
    const usageSummary =
      response.usage_summary ?? response.statistics ?? ({} as Partial<UsageSummary>);

    return {
      success: Boolean(response.success),
      customer_id: response.customer_id ?? '',
      token_limits: {
        monthly_limit: Number(tokenLimits.monthly_limit ?? 0),
        used_this_month: Number(tokenLimits.used_this_month ?? 0),
        balance_tokens: Number(tokenLimits.balance_tokens ?? 0),
        usage_percent: Number(tokenLimits.usage_percent ?? tokenLimits.usage_percentage ?? 0),
        usage_percentage: Number(tokenLimits.usage_percentage ?? tokenLimits.usage_percent ?? 0),
      },
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

  private normalizeRecentQuery(
    entry: Partial<RecentQuery> & { cost?: number; tokens_used?: number },
  ): RecentQuery {
    return {
      id: Number(entry.id ?? 0),
      query_text: entry.query_text ?? '',
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

    const used = this.usageData.token_limits.used_this_month;
    const limit = this.usageData.token_limits.monthly_limit;
    const remaining = Math.max(limit - used, 0);

    this.usageBreakdown = [
      {
        label: 'Used Tokens',
        value: used,
        percentage: limit > 0 ? (used / limit) * 100 : 0,
        color: this.colors.primary,
      },
      {
        label: 'Remaining Tokens',
        value: remaining,
        percentage: limit > 0 ? (remaining / limit) * 100 : 0,
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
    const usedPercentage = this.usageBreakdown[0]?.percentage ?? 0;
    return `conic-gradient(${this.colors.primary} 0 ${usedPercentage}%, ${this.colors.success} ${usedPercentage}% 100%)`;
  }

  get usagePercent(): number {
    return (
      this.usageData?.token_limits.usage_percent ??
      this.usageData?.token_limits.usage_percentage ??
      0
    );
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
}
