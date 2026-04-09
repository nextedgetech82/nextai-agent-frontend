import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
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
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
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
    this.customerAuthService
      .requestApiKey(customerId)
      .pipe(
        finalize(() => {
          this.ngZone.run(() => {
            this.loading = false;
            this.cdr.detectChanges();
          });
        }),
      )
      .subscribe({
        next: () => {
          this.ngZone.run(() => {
            this.cdr.detectChanges();
            void this.router.navigate(['/chat']);
          });
        },
        error: (error) => {
          this.ngZone.run(() => {
            this.error = error.message || 'Customer ID not registered';
            this.cdr.detectChanges();
          });
        },
      });
  }
}
