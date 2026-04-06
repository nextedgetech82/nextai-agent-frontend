import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { AnalyticsService } from './analytics.service';
import { AnalyticsChart, AnalyticsChartConfig } from '../models/analytics-response';

export interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  data?: any;
  sqlQuery?: string;
  insights?: string;
  chart?: AnalyticsChart;
  chartConfig?: AnalyticsChartConfig;
  isLoading?: boolean;
  isError?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root',
})
export class ChatbotService {
  private currentSessionSubject = new BehaviorSubject<ChatSession | null>(null);
  private sessionsSubject = new BehaviorSubject<ChatSession[]>([]);

  currentSession$ = this.currentSessionSubject.asObservable();
  sessions$ = this.sessionsSubject.asObservable();

  constructor(
    private analyticsService: AnalyticsService,
    private ngZone: NgZone,
  ) {
    this.loadSessions();
  }

  createNewSession(): ChatSession {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Conversation',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const sessions = this.sessionsSubject.value;
    sessions.unshift(newSession);
    this.sessionsSubject.next(sessions);
    this.currentSessionSubject.next(newSession);
    this.saveSessions();

    return newSession;
  }

  async sendMessage(sessionId: string, userMessage: string, insights: boolean = true): Promise<void> {
    const session = this.sessionsSubject.value.find((s) => s.id === sessionId);
    if (!session) return;

    // Add user message
    const userChatMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: userMessage,
      timestamp: new Date(),
    };

    session.messages.push(userChatMessage);

    // Add loading bot message
    const loadingMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'bot',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };
    session.messages.push(loadingMessage);
    this.updateSession(session);

    try {
      // Call API
      const response = await firstValueFrom(
        this.analyticsService.processQuery({ query: userMessage, insights }),
      );

      // Remove loading message and add actual response
      session.messages.pop();

      const botMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'bot',
        content: response.insights || "Here's your data:",
        timestamp: new Date(),
        data: response.data,
        sqlQuery: response.sqlQuery,
        insights: response.insights,
        chart: response.chart,
        chartConfig: response.chartConfig,
        isLoading: false,
      };

      session.messages.push(botMessage);
      session.updatedAt = new Date();

      // Update session title if it's the first message
      if (session.messages.length === 2) {
        session.title =
          userMessage.length > 30 ? userMessage.substring(0, 30) + '...' : userMessage;
      }

      this.updateSession(session);
    } catch (error: any) {
      // Remove loading message
      session.messages.pop();

      // Add error message
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'bot',
        content: `Sorry, I encountered an error: ${error.message || 'Please try again.'}`,
        timestamp: new Date(),
        isLoading: false,
        isError: true,
      };

      session.messages.push(errorMessage);
      this.updateSession(session);
    }
  }

  updateSession(session: ChatSession): void {
    const sessions = this.sessionsSubject.value;
    const index = sessions.findIndex((s) => s.id === session.id);
    if (index !== -1) {
      const updatedSession: ChatSession = {
        ...session,
        messages: [...session.messages],
      };
      const updatedSessions = [...sessions];
      updatedSessions[index] = updatedSession;

      this.ngZone.run(() => {
        this.sessionsSubject.next(updatedSessions);
        this.currentSessionSubject.next(updatedSession);
        this.saveSessions();
      });
    }
  }

  deleteSession(sessionId: string): void {
    let sessions = this.sessionsSubject.value;
    sessions = sessions.filter((s) => s.id !== sessionId);
    this.sessionsSubject.next(sessions);

    if (this.currentSessionSubject.value?.id === sessionId) {
      this.currentSessionSubject.next(sessions[0] || null);
    }
    this.saveSessions();
  }

  switchSession(sessionId: string): void {
    const session = this.sessionsSubject.value.find((s) => s.id === sessionId);
    if (session) {
      this.currentSessionSubject.next(session);
    }
  }

  clearSessions(): void {
    this.sessionsSubject.next([]);
    this.currentSessionSubject.next(null);
    localStorage.removeItem('chat_sessions');
  }

  private loadSessions(): void {
    const saved = localStorage.getItem('chat_sessions');
    if (saved) {
      const sessions = JSON.parse(saved);
      this.sessionsSubject.next(sessions);
      if (sessions.length > 0) {
        this.currentSessionSubject.next(sessions[0]);
      }
    }
  }

  private saveSessions(): void {
    localStorage.setItem('chat_sessions', JSON.stringify(this.sessionsSubject.value));
  }
}
