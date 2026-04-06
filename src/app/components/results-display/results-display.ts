import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { AnalyticsResponse } from '../../models/analytics-response';

@Component({
  selector: 'app-results-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './results-display.html',
  styleUrls: ['./results-display.css'],
})
export class ResultsDisplayComponent {
  private _response: AnalyticsResponse | null = null;

  @Input()
  set response(value: AnalyticsResponse | null) {
    this._response = value;
    this.activeTab = this.hasInsights ? 'insights' : 'table';
  }

  get response(): AnalyticsResponse | null {
    return this._response;
  }

  @Input() loading = false;

  activeTab: 'insights' | 'table' | 'sql' = 'insights';
  expandedSql = false;

  get hasInsights(): boolean {
    return !!this.response?.insights?.trim();
  }

  getColumns(data: any[]): string[] {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]);
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      // Show temporary tooltip or notification
      const tooltip = document.createElement('div');
      tooltip.textContent = 'Copied!';
      tooltip.className =
        'position-fixed top-50 start-50 translate-middle bg-success text-white p-2 rounded';
      document.body.appendChild(tooltip);
      setTimeout(() => tooltip.remove(), 1500);
    });
  }

  downloadAsCSV(): void {
    if (!this.response?.data) return;

    const headers = Object.keys(this.response.data[0]);
    const csvRows = [
      headers.join(','),
      ...this.response.data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            if (value === null || value === undefined) return '';
            if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
            return value;
          })
          .join(','),
      ),
    ];

    const csv = csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  formatInsights(insights: string): string {
    if (!insights) return '';
    return insights
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }
}
