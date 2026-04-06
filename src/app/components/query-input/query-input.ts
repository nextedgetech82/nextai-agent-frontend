import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AnalyticsService } from '../../services/analytics.service';
import { QueryRequest } from '../../models/query-request';

@Component({
  selector: 'app-query-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './query-input.html',
  styleUrls: ['./query-input.css'],
})
export class QueryInputComponent implements OnInit {
  @Input() isLoading = false;
  @Output() querySubmit = new EventEmitter<QueryRequest>();

  private fb = inject(FormBuilder);

  queryForm = this.fb.nonNullable.group({
    query: ['', [Validators.required, Validators.minLength(3)]],
    insights: [true],
  });
  suggestions: string[] = [];
  showSuggestions = false;

  constructor(
    private analyticsService: AnalyticsService,
  ) {}

  ngOnInit(): void {
    this.loadSuggestions();
  }

  loadSuggestions(): void {
    this.analyticsService.getSuggestions().subscribe({
      next: (response) => {
        this.suggestions = response.suggestions;
      },
      error: () => {
        // Fallback suggestions
        this.suggestions = [
          'Show top 10 customers by sales value',
          'Compare sales this month vs last month',
          'Show state-wise sales summary',
          'List party-wise sales performance',
          'What are our best selling products?',
          'Show monthly sales trend for 2026',
          'Which customers have the highest outstanding balance?',
        ];
      },
    });
  }

  onSubmit(): void {
    if (this.queryForm.valid && !this.isLoading) {
      this.querySubmit.emit(this.queryForm.getRawValue());
    }
  }

  useSuggestion(suggestion: string): void {
    this.queryForm.patchValue({ query: suggestion });
    this.showSuggestions = false;
    this.onSubmit();
  }

  toggleSuggestions(): void {
    this.showSuggestions = !this.showSuggestions;
  }

  clearInput(): void {
    this.queryForm.patchValue({ query: '' });
  }
}
