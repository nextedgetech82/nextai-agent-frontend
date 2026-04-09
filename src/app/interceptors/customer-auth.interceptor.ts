import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { CustomerAuthService } from '../services/customer-auth.service';

export const customerAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(CustomerAuthService);
  const apiKey = authService.getApiKey();
  const isCustomerApiKeyRequest = req.url.includes('/multi-customer/customer-api-key');
  const isProtectedRequest =
    req.url.includes('/multi-customer/') || req.url.includes('/api/v3/chat/');

  if (!apiKey || !isProtectedRequest || isCustomerApiKeyRequest) {
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
