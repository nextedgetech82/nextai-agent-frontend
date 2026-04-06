import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { EnterKeyNavigationDirective } from '../../directives/enter-key-navigation.directive';
import { CustomerAuthService } from '../../services/customer-auth.service';

@Component({
  selector: 'app-customer-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EnterKeyNavigationDirective],
  templateUrl: './customer-login.html',
  styleUrls: ['./customer-login.css'],
})
export class CustomerLoginComponent implements OnInit {
  private fb = inject(FormBuilder);

  loginForm = this.fb.nonNullable.group({
    customerId: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
  });

  loading = false;
  error: string | null = null;

  constructor(
    private customerAuthService: CustomerAuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (this.customerAuthService.isAuthenticated()) {
      void this.router.navigate(['/chat']);
    }
  }

  submit(): void {
    if (this.loginForm.invalid || this.loading) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = null;

    const { customerId } = this.loginForm.getRawValue();
    this.customerAuthService.requestApiKey(customerId).subscribe({
      next: () => {
        this.loading = false;
        void this.router.navigate(['/chat']);
      },
      error: (error) => {
        this.error = error.message;
        this.loading = false;
      },
    });
  }
}
