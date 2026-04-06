import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AnalyticsService } from './services/analytics.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App {
  title = 'Sales Analytics AI';

  constructor(private analyticsService: AnalyticsService) {}

  refresh(): void {
    window.location.reload();
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
