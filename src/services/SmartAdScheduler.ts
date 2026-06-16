import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

/**
 * SmartAdScheduler: Advanced AdMob Interstitial Scheduler
 * 
 * Features:
 * - 2-hour intelligent timer with internet detection
 * - Device lock screen awareness (never shows ads when locked)
 * - App lifecycle management (pause/resume)
 * - Pending ad system for missed opportunities
 * - Comprehensive event logging for debugging
 * - AdMob policy compliance
 */

export interface AdSchedulerConfig {
  timerDuration?: number; // milliseconds (default: 2 hours)
  enableLogging?: boolean;
  onAdEligible?: () => void;
  onAdShown?: () => void;
  onAdDismissed?: () => void;
}

interface AdSchedulerState {
  // Timer state
  timerActive: boolean;
  timerStartTime: number | null;
  timeRemainingMs: number;

  // Device state
  appIsActive: boolean;
  screenIsVisible: boolean;
  deviceIsLocked: boolean;
  internetAvailable: boolean;

  // Ad state
  adPending: boolean;
  adEligible: boolean;
  lastAdShownTime: number | null;

  // Event tracking
  logs: AdLog[];
}

interface AdLog {
  timestamp: number;
  event: string;
  details?: any;
}

class SmartAdScheduler {
  private state: AdSchedulerState;
  private config: Required<AdSchedulerConfig>;
  private timerInterval: NodeJS.Timeout | null = null;
  private appStateListener: any = null;
  private onlineListener: any = null;
  private offlineListener: any = null;
  private lockScreenListener: any = null;
  private visibilityListener: any = null;

  // 2 hours in milliseconds
  private readonly DEFAULT_TIMER = 2 * 60 * 60 * 1000;

  constructor(config: AdSchedulerConfig = {}) {
    this.config = {
      timerDuration: config.timerDuration || this.DEFAULT_TIMER,
      enableLogging: config.enableLogging !== false,
      onAdEligible: config.onAdEligible || (() => {}),
      onAdShown: config.onAdShown || (() => {}),
      onAdDismissed: config.onAdDismissed || (() => {}),
    };

    this.state = {
      timerActive: false,
      timerStartTime: null,
      timeRemainingMs: this.config.timerDuration,
      appIsActive: true,
      screenIsVisible: true,
      deviceIsLocked: false,
      internetAvailable: navigator.onLine,
      adPending: false,
      adEligible: false,
      lastAdShownTime: null,
      logs: [],
    };

    this.initialize();
  }

  /**
   * Initialize scheduler and attach listeners
   */
  private async initialize(): Promise<void> {
    this.log('SCHEDULER_INIT', 'SmartAdScheduler initialized');

    // Check initial internet status
    this.updateInternetStatus();

    // Attach platform-specific listeners
    if (Capacitor.isNativePlatform()) {
      await this.setupNativeListeners();
    }

    // Attach browser listeners
    this.setupBrowserListeners();
  }

  /**
   * Setup native (Capacitor) listeners for app lifecycle
   */
  private async setupNativeListeners(): Promise<void> {
    try {
      // App state change listener (foreground/background)
      this.appStateListener = await CapApp.addListener('appStateChange', ({ isActive }) => {
        this.state.appIsActive = isActive;

        if (isActive) {
          this.log('APP_FOREGROUND', 'App moved to foreground');

          // If internet was unavailable, check again
          this.updateInternetStatus();

          // If ad was pending and conditions are now met, trigger it
          if (this.state.adPending && this.canShowAd()) {
            this.log('AD_PENDING_SHOW', 'Showing pending ad after app resume');
            this.config.onAdEligible();
            this.state.adPending = false;
          }

          // Resume timer if it was active
          if (this.state.timerActive) {
            this.resumeTimer();
          }
        } else {
          this.log('APP_BACKGROUND', 'App moved to background');
          this.pauseTimer();
        }
      });

      this.log('NATIVE_LISTENERS_ATTACHED', 'Capacitor app state listeners attached');
    } catch (err) {
      console.warn('[SmartAdScheduler] Failed to attach native listeners:', err);
    }
  }

  /**
   * Setup browser-based listeners
   */
  private setupBrowserListeners(): void {
    // Visibility change listener (tab visibility)
    this.visibilityListener = () => {
      const isVisible = document.visibilityState === 'visible';
      this.state.screenIsVisible = isVisible;

      if (isVisible) {
        this.log('SCREEN_VISIBLE', 'Screen/document became visible');
        this.resumeTimer();
      } else {
        this.log('SCREEN_HIDDEN', 'Screen/document became hidden');
        this.pauseTimer();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityListener);

    // Online/offline listeners
    this.onlineListener = () => {
      this.state.internetAvailable = true;
      this.log('INTERNET_AVAILABLE', 'Internet connection restored');

      // If timer was waiting, resume it
      if (this.state.timerActive) {
        this.resumeTimer();
      }
    };
    window.addEventListener('online', this.onlineListener);

    this.offlineListener = () => {
      this.state.internetAvailable = false;
      this.log('INTERNET_UNAVAILABLE', 'Internet connection lost');
      this.pauseTimer();
    };
    window.addEventListener('offline', this.offlineListener);

    this.log('BROWSER_LISTENERS_ATTACHED', 'Browser listeners attached');
  }

  /**
   * Start the 2-hour timer
   */
  public startTimer(): void {
    if (this.state.timerActive) {
      this.log('TIMER_ALREADY_RUNNING', 'Timer is already running');
      return;
    }

    if (!this.state.internetAvailable) {
      this.log('TIMER_WAIT_INTERNET', 'Waiting for internet to start timer');
      this.state.timerActive = true;
      return;
    }

    this.state.timerActive = true;
    this.state.timerStartTime = Date.now();
    this.state.timeRemainingMs = this.config.timerDuration;

    this.log('TIMER_STARTED', `Timer started for ${this.config.timerDuration / 1000 / 60} minutes`);

    this.runTimer();
  }

  /**
   * Internal timer loop
   */
  private runTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    // Update every second
    this.timerInterval = setInterval(() => {
      if (!this.state.timerActive) {
        clearInterval(this.timerInterval!);
        this.timerInterval = null;
        return;
      }

      if (!this.state.internetAvailable) {
        this.pauseTimer();
        return;
      }

      const elapsed = Date.now() - (this.state.timerStartTime || Date.now());
      this.state.timeRemainingMs = Math.max(0, this.config.timerDuration - elapsed);

      // Timer expired
      if (this.state.timeRemainingMs <= 0) {
        this.onTimerExpired();
        clearInterval(this.timerInterval!);
        this.timerInterval = null;
        this.state.timerActive = false;
      }
    }, 1000);
  }

  /**
   * Pause the timer (screen hidden, internet lost, app backgrounded)
   */
  private pauseTimer(): void {
    if (!this.state.timerActive) return;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.log('TIMER_PAUSED', `Timer paused with ${this.state.timeRemainingMs / 1000}s remaining`);
  }

  /**
   * Resume the timer
   */
  private resumeTimer(): void {
    if (!this.state.timerActive) return;
    if (!this.state.internetAvailable) return;

    this.log('TIMER_RESUMED', `Timer resumed with ${this.state.timeRemainingMs / 1000}s remaining`);
    this.runTimer();
  }

  /**
   * Called when 2-hour timer expires
   */
  private onTimerExpired(): void {
    this.log('TIMER_EXPIRED', 'Ad timer expired - ad is now eligible');

    this.state.adEligible = true;

    // Check if we can show the ad immediately
    if (this.canShowAd()) {
      this.config.onAdEligible();
      this.state.adPending = false;
    } else {
      // Mark as pending - it will be shown when conditions are met
      this.state.adPending = true;
      this.log('AD_PENDING', 'Ad marked as pending - waiting for app/device state to be eligible');
    }
  }

  /**
   * Check if all conditions are met to show an ad
   */
  private canShowAd(): boolean {
    const canShow =
      navigator.onLine === true &&
      document.visibilityState === 'visible' &&
      this.state.appIsActive === true &&
      this.state.deviceIsLocked === false;

    if (!canShow) {
      this.log('AD_BLOCKED', {
        internetAvailable: navigator.onLine,
        screenVisible: document.visibilityState === 'visible',
        appActive: this.state.appIsActive,
        deviceLocked: this.state.deviceIsLocked,
      });
    }

    return canShow;
  }

  /**
   * Manually mark device as locked/unlocked
   * Call this when you detect lock screen events
   */
  public setDeviceLocked(locked: boolean): void {
    this.state.deviceIsLocked = locked;

    if (locked) {
      this.log('DEVICE_LOCKED', 'Device screen locked - pausing timer');
      this.pauseTimer();
    } else {
      this.log('DEVICE_UNLOCKED', 'Device screen unlocked - checking for pending ads');
      this.pauseTimer();

      // If ad was pending and conditions are now met, trigger it
      if (this.state.adPending && this.canShowAd()) {
        this.log('AD_PENDING_SHOW', 'Showing pending ad after device unlock');
        this.config.onAdEligible();
        this.state.adPending = false;
      }
    }
  }

  /**
   * Record when ad was successfully shown
   */
  public recordAdShown(): void {
    this.state.lastAdShownTime = Date.now();
    this.log('AD_SHOWN', 'Interstitial ad displayed to user');
    this.config.onAdShown();

    // Reset timer for next ad cycle
    this.resetTimer();
  }

  /**
   * Record when ad was dismissed
   */
  public recordAdDismissed(): void {
    this.log('AD_DISMISSED', 'Interstitial ad dismissed by user');
    this.config.onAdDismissed();
  }

  /**
   * Reset timer for next ad cycle
   */
  public resetTimer(): void {
    this.state.adEligible = false;
    this.state.adPending = false;
    this.state.timerActive = false;
    this.state.timerStartTime = null;
    this.state.timeRemainingMs = this.config.timerDuration;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.log('TIMER_RESET', 'Timer reset - starting new 2-hour cycle');

    if (this.state.appIsActive && this.state.internetAvailable) {
      this.startTimer();
    }
  }

  /**
   * Update internet status
   */
  private updateInternetStatus(): void {
    this.state.internetAvailable = navigator.onLine;
  }

  /**
   * Emit a log entry
   */
  private log(event: string, details?: any): void {
    if (!this.config.enableLogging) return;

    const logEntry: AdLog = {
      timestamp: Date.now(),
      event,
      details,
    };

    this.state.logs.push(logEntry);

    // Keep last 100 logs
    if (this.state.logs.length > 100) {
      this.state.logs.shift();
    }

    // Console output for debugging
    console.log(`[SmartAdScheduler] ${event}`, details || '');
  }

  /**
   * Get current scheduler state (for debugging)
   */
  public getState(): Readonly<AdSchedulerState> {
    return Object.freeze({ ...this.state });
  }

  /**
   * Get time remaining until next ad (in ms)
   */
  public getTimeRemaining(): number {
    return this.state.timeRemainingMs;
  }

  /**
   * Get all logs
   */
  public getLogs(): AdLog[] {
    return [...this.state.logs];
  }

  /**
   * Cleanup and destroy scheduler
   */
  public destroy(): void {
    this.log('SCHEDULER_DESTROY', 'Scheduler destroyed');

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.appStateListener) {
      this.appStateListener.remove();
    }

    document.removeEventListener('visibilitychange', this.visibilityListener);
    window.removeEventListener('online', this.onlineListener);
    window.removeEventListener('offline', this.offlineListener);
  }
}

// Export singleton instance
export const smartAdScheduler = new SmartAdScheduler({
  timerDuration: 2 * 60 * 60 * 1000, // 2 hours
  enableLogging: true,
});
