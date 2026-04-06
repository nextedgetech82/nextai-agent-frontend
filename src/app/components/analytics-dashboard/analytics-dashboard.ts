import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { QueryInputComponent } from '../query-input/query-input';
import { ResultsDisplayComponent } from '../results-display/results-display';
import { AnalyticsService } from '../../services/analytics.service';
import { AnalyticsResponse } from '../../models/analytics-response';
import { QueryRequest } from '../../models/query-request';

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, QueryInputComponent, ResultsDisplayComponent],
  templateUrl: './analytics-dashboard.html',
  styleUrls: ['./analytics-dashboard.css'],
})
export class AnalyticsDashboardComponent implements OnInit {
  response: AnalyticsResponse | null = null;
  loading = false;
  error: string | null = null;
  recentQueries: string[] = [];

  constructor(private analyticsService: AnalyticsService) {}

  ngOnInit(): void {
    this.loadRecentQueries();
  }

  onQuerySubmit(request: QueryRequest): void {
    this.loading = true;
    this.error = null;
    this.response = null;

    this.analyticsService.processQuery(request).subscribe({
      next: (response) => {
        this.response = response;
        this.loading = false;
        this.saveToRecentQueries(request.query);
      },
      error: (error) => {
        this.error = error.message;
        this.loading = false;
      },
    });
  }

  loadRecentQueries(): void {
    const saved = localStorage.getItem('recentQueries');
    if (saved) {
      this.recentQueries = JSON.parse(saved);
    }
  }

  saveToRecentQueries(query: string): void {
    this.recentQueries = [query, ...this.recentQueries.filter((q) => q !== query)].slice(0, 10);
    localStorage.setItem('recentQueries', JSON.stringify(this.recentQueries));
  }

  clearRecentQueries(): void {
    this.recentQueries = [];
    localStorage.removeItem('recentQueries');
  }

  clearCache(): void {
    if (confirm('Clear all cached analytics data?')) {
      this.analyticsService.clearCache().subscribe({
        next: () => {
          alert('Cache cleared successfully');
        },
        error: (err) => {
          alert('Failed to clear cache: ' + err.message);
        },
      });
    }
  }
}
