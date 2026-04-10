import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import {
  AnalyticsService,
  ChatSessionApiItem,
  ChatSessionApiMessage,
  ChatSessionListResponse,
  ChatSessionResponse,
} from './analytics.service';
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
  private readonly currentSessionStorageKey = 'current_chat_session_id';
  private currentSessionSubject = new BehaviorSubject<ChatSession | null>(null);
  private sessionsSubject = new BehaviorSubject<ChatSession[]>([]);

  currentSession$ = this.currentSessionSubject.asObservable();
  sessions$ = this.sessionsSubject.asObservable();

  constructor(
    private analyticsService: AnalyticsService,
    private ngZone: NgZone,
  ) {}

  async initialize(): Promise<void> {
    await this.refreshSessions();

    const currentSessionId = this.getStoredCurrentSessionId();
    const fallbackSessionId = this.sessionsSubject.value[0]?.id ?? null;
    const targetSessionId = currentSessionId || fallbackSessionId;

    if (targetSessionId) {
      await this.switchSession(targetSessionId);
      return;
    }

    this.ngZone.run(() => {
      this.currentSessionSubject.next(null);
    });
  }

  async createNewSession(): Promise<ChatSession> {
    const draftSession: ChatSession = {
      id: '',
      title: 'New Conversation',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.clearStoredCurrentSessionId();
    this.ngZone.run(() => {
      this.sessionsSubject.next(this.sessionsSubject.value.filter((session) => !!session.id));
      this.currentSessionSubject.next(draftSession);
    });

    return draftSession;
  }

  async sendMessage(
    sessionId: string | null,
    userMessage: string,
    insights: boolean = true,
    chart: boolean = true,
  ): Promise<void> {
    let activeSession = this.sessionsSubject.value.find((session) => session.id === sessionId);

    if (!activeSession) {
      activeSession = await this.createNewSession();
    }

    const userChatMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: userMessage,
      timestamp: new Date(),
    };

    const loadingMessage: ChatMessage = {
      id: `${Date.now() + 1}`,
      type: 'bot',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    const optimisticSession: ChatSession = {
      ...activeSession,
      messages: [...activeSession.messages, userChatMessage, loadingMessage],
      updatedAt: new Date(),
    };

    if (optimisticSession.id) {
      this.upsertSession(optimisticSession);
    } else {
      this.ngZone.run(() => {
        this.currentSessionSubject.next({
          ...optimisticSession,
          messages: [...optimisticSession.messages],
        });
      });
    }

    try {
      const response = await firstValueFrom(
        this.analyticsService.processQuery({ query: userMessage, insights, chart }, activeSession.id),
      );

      const responseSessionId = response.session_id || optimisticSession.id;
      const botMessage: ChatMessage = {
        id: `${Date.now() + 2}`,
        type: 'bot',
        content: response.insights || "Here's your data:",
        timestamp: response.timestamp ? new Date(response.timestamp) : new Date(),
        data: response.data,
        sqlQuery: response.sqlQuery,
        insights: response.insights,
        chart: response.chart,
        chartConfig: response.chartConfig,
        isLoading: false,
      };

      const finalizedSession: ChatSession = {
        ...optimisticSession,
        id: responseSessionId,
        messages: [...optimisticSession.messages.slice(0, -1), botMessage],
        updatedAt: botMessage.timestamp,
        title:
          activeSession.title === 'New Conversation'
            ? this.buildSessionTitle(userMessage)
            : activeSession.title,
      };

      this.upsertSession(finalizedSession);
      this.persistCurrentSessionId(responseSessionId);
      await this.refreshSessions();
      await this.switchSession(responseSessionId);
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        id: `${Date.now() + 2}`,
        type: 'bot',
        content: `Sorry, I encountered an error: ${error.message || 'Please try again.'}`,
        timestamp: new Date(),
        isLoading: false,
        isError: true,
      };

      const failedSession: ChatSession = {
        ...optimisticSession,
        messages: [...optimisticSession.messages.slice(0, -1), errorMessage],
        updatedAt: errorMessage.timestamp,
      };

      if (failedSession.id) {
        this.upsertSession(failedSession);
      } else {
        this.ngZone.run(() => {
          this.currentSessionSubject.next({
            ...failedSession,
            messages: [...failedSession.messages],
          });
        });
      }
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    await firstValueFrom(this.analyticsService.deleteChatSession(sessionId));

    const remainingSessions = this.sessionsSubject.value.filter((session) => session.id !== sessionId);
    this.ngZone.run(() => {
      this.sessionsSubject.next(remainingSessions);
    });

    if (this.currentSessionSubject.value?.id === sessionId) {
      const nextSessionId = remainingSessions[0]?.id ?? null;
      if (nextSessionId) {
        await this.switchSession(nextSessionId);
      } else {
        this.clearStoredCurrentSessionId();
        this.ngZone.run(() => {
          this.currentSessionSubject.next(null);
        });
      }
      return;
    }

    this.persistCurrentSessionId(this.currentSessionSubject.value?.id ?? null);
  }

  async switchSession(sessionId: string): Promise<void> {
    const response = await firstValueFrom(this.analyticsService.getChatSession(sessionId));
    const normalized = this.normalizeSession(this.extractSessionItem(response), true);
    this.upsertSession(normalized);
    this.persistCurrentSessionId(normalized.id);
  }

  async clearSessions(): Promise<void> {
    await firstValueFrom(this.analyticsService.clearChatSessions());
    this.resetLocalState();
  }

  resetLocalState(): void {
    this.clearStoredCurrentSessionId();

    this.ngZone.run(() => {
      this.sessionsSubject.next([]);
      this.currentSessionSubject.next(null);
    });
  }

  private async refreshSessions(): Promise<void> {
    const response = await firstValueFrom(this.analyticsService.listChatSessions());
    const sessions = this.normalizeSessionListResponse(response);

    this.ngZone.run(() => {
      this.sessionsSubject.next(sessions);
    });
  }

  private normalizeSessionListResponse(response: ChatSessionListResponse): ChatSession[] {
    const rows = response.sessions ?? response.data ?? response.items ?? [];
    return rows.map((item) => this.normalizeSession(item, false));
  }

  private extractSessionItem(response: ChatSessionResponse): ChatSessionApiItem {
    const session = response.session ?? response.data ?? response;
    return {
      ...session,
      messages:
        session.messages ??
        session.chat_history ??
        session.history ??
        session.session_messages ??
        response.messages ??
        response.chat_history ??
        response.history ??
        response.session_messages ??
        [],
    };
  }

  private normalizeSession(item: ChatSessionApiItem, includeMessages: boolean): ChatSession {
    const sessionId = String(item.id ?? item.session_id ?? Date.now());
    const createdAt = this.parseDate(item.createdAt ?? item.created_at);
    const updatedAt = this.parseDate(item.updatedAt ?? item.updated_at, createdAt);
    const rawMessages =
      item.messages ?? item.chat_history ?? item.history ?? item.session_messages ?? [];
    const messages = includeMessages ? this.normalizeMessages(rawMessages) : [];

    return {
      id: sessionId,
      title: item.title || item.session_title || 'New Conversation',
      messages,
      createdAt,
      updatedAt,
    };
  }

  private normalizeMessages(messages: ChatSessionApiMessage[]): ChatMessage[] {
    return messages.flatMap((message, index) => this.normalizeMessagePair(message, index));
  }

  private normalizeMessagePair(message: ChatSessionApiMessage, index: number): ChatMessage[] {
    const timestamp = this.parseDate(message.createdAt ?? message.created_at ?? message.timestamp);
    const baseId = String(message.id ?? `${Date.now()}-${index}`);
    const normalizedType = this.normalizeMessageType(message);
    const botPayload = this.extractBotPayload(message);
    const userContent = this.normalizeContent(
      normalizedType === 'user'
        ? message.content ?? message.message ?? message.query ?? message.query_text ?? message.prompt ?? message.user_query
        : message.query ?? message.query_text ?? message.prompt ?? message.user_query,
    );
    const botContent = this.normalizeContent(
      normalizedType === 'bot'
        ? message.content ?? message.message ?? message.response ?? message.answer ?? botPayload.insights
        : message.response ?? message.answer ?? message.content ?? message.message ?? botPayload.insights,
    );

    if (userContent && botContent) {
      return [
        {
          id: `${baseId}-user`,
          type: 'user',
          content: userContent,
          timestamp,
        },
        {
          id: `${baseId}-bot`,
          type: 'bot',
          content: botContent,
          timestamp,
          data: botPayload.data,
          sqlQuery: botPayload.sqlQuery,
          insights: botPayload.insights,
          chart: botPayload.chart,
          chartConfig: botPayload.chartConfig,
          isError: Boolean(message.isError ?? message.is_error),
          isLoading: false,
        },
      ];
    }

    const type = this.normalizeMessageType(message, userContent);
    const content = type === 'user' ? userContent : botContent;

    if (!content) {
      return [];
    }

    return [
      {
        id: baseId,
        type,
        content: content ?? '',
        timestamp,
        data: type === 'bot' ? botPayload.data : undefined,
        sqlQuery: type === 'bot' ? botPayload.sqlQuery : undefined,
        insights: type === 'bot' ? botPayload.insights : undefined,
        chart: type === 'bot' ? botPayload.chart : undefined,
        chartConfig: type === 'bot' ? botPayload.chartConfig : undefined,
        isError: type === 'bot' ? Boolean(message.isError ?? message.is_error) : false,
        isLoading: false,
      },
    ];
  }

  private normalizeMessageType(message: ChatSessionApiMessage, userContent?: string): 'user' | 'bot' {
    const rawType = (message.type ?? message.role ?? message.sender ?? message.message_type ?? '').toLowerCase();
    if (rawType === 'user' || rawType === 'human' || rawType === 'prompt') {
      return 'user';
    }

    if (rawType === 'assistant' || rawType === 'bot' || rawType === 'response' || rawType === 'system') {
      return 'bot';
    }

    if (userContent) {
      return 'user';
    }

    return 'bot';
  }

  private normalizeContent(value?: string): string | null {
    if (!value) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private extractBotPayload(message: ChatSessionApiMessage): {
    chart?: AnalyticsChart;
    chartConfig?: AnalyticsChartConfig;
    data?: any[];
    insights?: string;
    sqlQuery?: string;
  } {
    const analyticsResponse = message.analytics_response;
    const data = this.normalizeDataArray(
      message.data ??
        message.data_json ??
        message.rows ??
        message.results ??
        message.table_data ??
        message.response_data ??
        message.analytics_data ??
        analyticsResponse?.data,
    );
    const chartConfig = this.normalizeJsonValue<AnalyticsChartConfig>(
      message.chartConfig ?? message.chart_config ?? analyticsResponse?.chartConfig ?? analyticsResponse?.chart_config,
    );

    return {
      data,
      sqlQuery: message.sqlQuery ?? message.sql_query ?? analyticsResponse?.sqlQuery ?? analyticsResponse?.sql_query,
      insights: message.insights ?? analyticsResponse?.insights,
      chart: message.chart ?? analyticsResponse?.chart,
      chartConfig,
    };
  }

  private normalizeDataArray(value: unknown): any[] | undefined {
    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = this.normalizeJsonValue<unknown>(value);
      return Array.isArray(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  private normalizeJsonValue<T>(value: unknown): T | undefined {
    if (value == null) {
      return undefined;
    }

    if (typeof value !== 'string') {
      return value as T;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }

  private upsertSession(session: ChatSession): void {
    const existingSessions = this.sessionsSubject.value;
    const sessionSummary: ChatSession = {
      ...session,
      messages: [...session.messages],
    };
    const index = existingSessions.findIndex((item) => item.id === session.id);
    let nextSessions: ChatSession[];

    if (index === -1) {
      nextSessions = [sessionSummary, ...existingSessions];
    } else {
      nextSessions = [...existingSessions];
      nextSessions[index] = sessionSummary;
      nextSessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    this.ngZone.run(() => {
      this.sessionsSubject.next(nextSessions);
      this.currentSessionSubject.next(sessionSummary);
    });
  }

  private buildSessionTitle(message: string): string {
    return message.length > 30 ? `${message.substring(0, 30)}...` : message;
  }

  private parseDate(value?: string, fallback: Date = new Date()): Date {
    if (!value) {
      return fallback;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  }

  private getStoredCurrentSessionId(): string | null {
    return localStorage.getItem(this.currentSessionStorageKey);
  }

  private persistCurrentSessionId(sessionId: string | null): void {
    if (!sessionId) {
      this.clearStoredCurrentSessionId();
      return;
    }

    localStorage.setItem(this.currentSessionStorageKey, sessionId);
  }

  private clearStoredCurrentSessionId(): void {
    localStorage.removeItem(this.currentSessionStorageKey);
  }
}
