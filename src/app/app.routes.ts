import { Routes } from '@angular/router';
import { ChatbotComponent } from './components/chatbot/chatbot';
import { CustomerLoginComponent } from './components/customer-login/customer-login';
import { customerAuthGuard } from './guards/customer-auth.guard';
import { AnalyticsDashboardComponent } from './components/analytics-dashboard/analytics-dashboard';
import { TokenUsageComponent } from './components/token-usage/token-usage';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: CustomerLoginComponent },
  { path: 'chat', component: ChatbotComponent, canActivate: [customerAuthGuard] },
  { path: 'usage', component: TokenUsageComponent },
  { path: 'dashboard', component: AnalyticsDashboardComponent },
  { path: '**', redirectTo: '' },
];
