import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, HostListener, NgZone, OnInit, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatMessageComponent } from '../chat-message/chat-message';
import { ChatbotService, ChatSession, ChatMessage } from '../../services/chatbot';
import { CustomerAuthService } from '../../services/customer-auth.service';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ChatMessageComponent],
  templateUrl: './chatbot.html',
  styleUrls: ['./chatbot.css'],
})
export class ChatbotComponent implements OnInit {
  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  private fb = inject(FormBuilder);

  messageForm = this.fb.nonNullable.group({
    message: ['', Validators.required],
    insights: [true],
  });
  currentSession: ChatSession | null = null;
  sessions: ChatSession[] = [];
  showSidebar = true;
  isTyping = false;
  isMobileLayout = false;

  suggestedQuestions = [
    'Show last bill date and bill number',
    'Top 5 customers by sales value',
    'Compare sales this month vs last month',
    'Show state-wise sales summary',
    'What are our best selling products?',
    'Show monthly sales trend for 2026',
  ];

  constructor(
    private chatbotService: ChatbotService,
    private customerAuthService: CustomerAuthService,
    private router: Router,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.syncLayoutWithViewport();

    this.chatbotService.currentSession$.subscribe((session) => {
      this.ngZone.run(() => {
        const previousSessionId = this.currentSession?.id ?? null;
        const previousMessageCount = this.currentSession?.messages?.length ?? 0;
        this.currentSession = session
          ? {
              ...session,
              messages: [...session.messages],
            }
          : null;
        this.cdr.detectChanges();

        const nextSessionId = this.currentSession?.id ?? null;
        const nextMessageCount = this.currentSession?.messages?.length ?? 0;
        const sessionChanged = previousSessionId !== nextSessionId;
        const messageCountChanged = previousMessageCount !== nextMessageCount;

        if (sessionChanged || messageCountChanged) {
          this.scrollToBottom();
        }
      });
    });

    this.chatbotService.sessions$.subscribe((sessions) => {
      this.ngZone.run(() => {
        this.sessions = sessions.map((session) => ({
          ...session,
          messages: [...session.messages],
        }));
        this.cdr.detectChanges();
      });
    });

    // Create new session if none exists
    if (this.sessions.length === 0) {
      this.newChat();
    }
  }

  newChat(): void {
    this.chatbotService.createNewSession();
    this.messageForm.reset({ message: '', insights: true });
  }

  sendMessage(): void {
    if (this.messageForm.invalid || !this.currentSession) return;

    const { message, insights } = this.messageForm.getRawValue();
    this.chatbotService.sendMessage(this.currentSession.id, message, insights);
    this.messageForm.patchValue({ message: '' });
    this.cdr.detectChanges();
  }

  switchSession(sessionId: string): void {
    this.chatbotService.switchSession(sessionId);
  }

  deleteSession(sessionId: string, event: Event): void {
    event.stopPropagation();
    if (confirm('Delete this conversation?')) {
      this.chatbotService.deleteSession(sessionId);
    }
  }

  useSuggestion(suggestion: string): void {
    this.messageForm.patchValue({ message: suggestion });
    this.sendMessage();
  }

  clearAllChats(): void {
    if (confirm('Delete all conversations? This cannot be undone.')) {
      this.chatbotService.clearSessions();
      this.newChat();
    }
  }

  toggleSidebar(): void {
    this.showSidebar = !this.showSidebar;
  }

  closeSidebar(): void {
    if (this.isMobileLayout) {
      this.showSidebar = false;
    }
  }

  goToUsage(): void {
    void this.router.navigate(['/usage']);
  }

  logout(): void {
    this.customerAuthService.clearCredentials();
    this.chatbotService.clearSessions();
    void this.router.navigate(['/login']);
  }

  private scrollToBottom(): void {
    try {
      if (this.chatContainer) {
        this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
      }
    } catch (err) {}
  }

  formatDate(date: Date): string {
    const now = new Date();
    const msgDate = new Date(date);
    const diffDays = Math.floor((now.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return msgDate.toLocaleDateString();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.syncLayoutWithViewport();
  }

  private syncLayoutWithViewport(): void {
    const isMobile = window.innerWidth <= 992;
    this.isMobileLayout = isMobile;
    this.showSidebar = !isMobile;
  }
}
