import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { CustomerAuthService } from '../services/customer-auth.service';

export const customerAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(CustomerAuthService);
  const apiKey = authService.getApiKey();
  const isCustomerApiKeyRequest = req.url.includes('/multi-customer/customer-api-key');
  const isProtectedMultiCustomerRequest = req.url.includes('/multi-customer/');

  if (!apiKey || !isProtectedMultiCustomerRequest || isCustomerApiKeyRequest) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: {
        Authorization: `Bearer ${apiKey}`,
      },
    }),
  );
};
