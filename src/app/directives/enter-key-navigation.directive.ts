import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  selector: 'form[appEnterKeyNavigation]',
  standalone: true,
})
export class EnterKeyNavigationDirective {
  constructor(private elementRef: ElementRef<HTMLFormElement>) {}

  @HostListener('keydown.enter', ['$event'])
  onEnterKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;

    if (!target || target.tagName === 'TEXTAREA') {
      return;
    }

    const focusableElements = this.getFocusableElements();
    const currentIndex = focusableElements.indexOf(target);

    if (currentIndex === -1) {
      return;
    }

    event.preventDefault();

    const nextElement = focusableElements[currentIndex + 1];
    if (nextElement) {
      nextElement.focus();
      return;
    }

    this.elementRef.nativeElement.requestSubmit();
  }

  private getFocusableElements(): HTMLElement[] {
    return Array.from(
      this.elementRef.nativeElement.querySelectorAll<HTMLElement>(
        'input, button, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1);
  }
}
