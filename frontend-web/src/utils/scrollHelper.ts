/**
 * Utility to reliably scroll the dashboard and window to the top.
 * Handles nested scrollable containers such as #dashboard-main-content and .overflow-y-auto.
 */
export const scrollToTop = (targetEl?: HTMLElement | null) => {
  const doScroll = () => {
    // 1. Direct target element scroll
    if (targetEl && typeof targetEl.scrollIntoView === 'function') {
      try {
        targetEl.scrollIntoView({ behavior: 'instant', block: 'start' });
      } catch {
        targetEl.scrollIntoView(true);
      }
    }

    // 2. Target specific dashboard container
    const mainDashboardContainer = document.getElementById('dashboard-main-content');
    if (mainDashboardContainer) {
      mainDashboardContainer.scrollTop = 0;
    }

    // 3. Any scrollable container in dashboard / layout
    const scrollContainers = document.querySelectorAll<HTMLElement>(
      '.overflow-y-auto, .overflow-auto, main, [data-scroll-container]'
    );
    scrollContainers.forEach((el) => {
      el.scrollTop = 0;
    });

    // 4. Target element with id crop-page-top if available
    const pageTopAnchor = document.getElementById('crop-page-top');
    if (pageTopAnchor) {
      try {
        pageTopAnchor.scrollIntoView({ behavior: 'instant', block: 'start' });
      } catch {
        pageTopAnchor.scrollIntoView(true);
      }
    }

    // 5. Window and body fallbacks
    if (typeof window !== 'undefined') {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      } catch {
        window.scrollTo(0, 0);
      }
    }
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }
  };

  // Immediate execution
  doScroll();

  // Run on next animation frames for smooth mounting transitions
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      doScroll();
      requestAnimationFrame(doScroll);
    });
  }

  // Backup timers for any late DOM layout shifts / lazy loaded chunks
  setTimeout(doScroll, 20);
  setTimeout(doScroll, 80);
  setTimeout(doScroll, 200);
};

