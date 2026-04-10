import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
  private autoLoginAttempted = false;
  private routeCustomerId: string | null = null;

  loginForm = this.fb.nonNullable.group({
    customerId: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
  });

  loading = false;
  error: string | null = null;
  showDirectAccessError = false;

  constructor(
    private customerAuthService: CustomerAuthService,
    private router: Router,
    private route: ActivatedRoute,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.routeCustomerId =
      this.route.snapshot.paramMap.get('customerId') ??
      this.route.snapshot.queryParamMap.get('customerId') ??
      this.route.snapshot.queryParamMap.get('customer_id');

    if (this.routeCustomerId) {
      this.loginForm.patchValue({ customerId: this.routeCustomerId });

      const storedCustomerId = this.customerAuthService.getCustomerId();
      if (
        this.customerAuthService.isAuthenticated() &&
        storedCustomerId &&
        storedCustomerId !== this.routeCustomerId
      ) {
        this.customerAuthService.clearCredentials();
      }

      this.tryAutoLogin(this.routeCustomerId);
      return;
    }

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
    this.showDirectAccessError = false;

    const { customerId } = this.loginForm.getRawValue();
    this.customerAuthService
      .requestApiKey(customerId, !!this.routeCustomerId)
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
            this.showDirectAccessError = !!this.routeCustomerId;
            this.cdr.detectChanges();
          });
        },
      });
  }

  private tryAutoLogin(customerId: string): void {
    if (this.autoLoginAttempted) {
      return;
    }

    this.autoLoginAttempted = true;

    if (!/^\d{10}$/.test(customerId)) {
      this.error = 'Enter a valid 10 digit mobile number.';
      this.showDirectAccessError = true;
      this.cdr.detectChanges();
      return;
    }

    if (this.customerAuthService.isAuthenticated()) {
      void this.router.navigate(['/chat']);
      return;
    }

    this.submit();
  }

  goToManualLogin(): void {
    this.routeCustomerId = null;
    this.showDirectAccessError = false;
    this.error = null;
    this.loginForm.markAsUntouched();
    void this.router.navigate(['/login']);
  }
}
