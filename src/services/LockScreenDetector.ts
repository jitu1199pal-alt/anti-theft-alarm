import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

/**
 * Lock Screen Detector - Detects when device is locked/unlocked
 * Works with native Android and web fallbacks
 */

interface LockScreenDetectorConfig {
  onLocked?: () => void;
  onUnlocked?: () => void;
  enableLogging?: boolean;
}

class LockScreenDetector {
  private isLocked = false;
  private wakeLockSentinel: any = null;
  private screenListener: any = null;
  private onLocked: () => void;
  private onUnlocked: () => void;
  private enableLogging: boolean;

  constructor(config: LockScreenDetectorConfig = {}) {
    this.onLocked = config.onLocked || (() => {});
    this.onUnlocked = config.onUnlocked || (() => {});
    this.enableLogging = config.enableLogging !== false;

    this.initialize();
  }

  private log(msg: string): void {
    if (this.enableLogging) {
      console.log(`[LockScreenDetector] ${msg}`);
    }
  }

  private initialize(): void {
    this.log('Initializing Lock Screen Detector');

    // Method 1: Screen Orientation Lock Heuristic (works on web & some native)
    this.detectViaScreenOrientation();

    // Method 2: Native Capacitor Plugin (Android-specific)
    if (Capacitor.isNativePlatform()) {
      this.detectViaKeyguard();
    }
  }

  /**
   * Fallback: Detect lock via screen orientation changes
   * When device is locked, orientation sensor is typically blocked
   */
  private detectViaScreenOrientation(): void {
    let lastOrientation = window.orientation;
    let noOrientationChangeCount = 0;

    const orientationCheck = setInterval(() => {
      const currentOrientation = window.orientation;

      if (currentOrientation === lastOrientation) {
        noOrientationChangeCount++;
      } else {
        lastOrientation = currentOrientation;
        noOrientationChangeCount = 0;
      }

      // If orientation hasn't changed for ~30 seconds, likely locked
      if (noOrientationChangeCount > 30) {
        if (!this.isLocked) {
          this.isLocked = true;
          this.log('Device appears LOCKED (orientation not changing)');
          this.onLocked();
        }
      } else {
        if (this.isLocked) {
          this.isLocked = false;
          this.log('Device appears UNLOCKED (orientation changing)');
          this.onUnlocked();
        }
      }
    }, 1000);
  }

  /**
   * Native: Detect lock via KeyguardManager
   * This requires a native Capacitor plugin
   */
  private async detectViaKeyguard(): Promise<void> {
    try {
      // Try to use native plugin if available
      const KeyguardPlugin = registerPlugin('KeyguardPlugin');

      const checkLock = async () => {
        try {
          const { isKeyguardSecure } = await (KeyguardPlugin as any).isKeyguardSecure();

          if (isKeyguardSecure && !this.isLocked) {
            this.isLocked = true;
            this.log('Device LOCKED (Keyguard detected)');
            this.onLocked();
          } else if (!isKeyguardSecure && this.isLocked) {
            this.isLocked = false;
            this.log('Device UNLOCKED (Keyguard removed)');
            this.onUnlocked();
          }
        } catch (e) {
          // Plugin not available, fall back to screen orientation method
        }
      };

      // Check every 500ms
      setInterval(checkLock, 500);
    } catch (e) {
      this.log('Native Keyguard detection not available, using orientation fallback');
    }
  }

  /**
   * Get current lock state
   */
  public getIsLocked(): boolean {
    return this.isLocked;
  }

  /**
   * Manually set lock state (useful for testing)
   */
  public setIsLocked(locked: boolean): void {
    if (locked !== this.isLocked) {
      this.isLocked = locked;
      if (locked) {
        this.log('Manually set device to LOCKED');
        this.onLocked();
      } else {
        this.log('Manually set device to UNLOCKED');
        this.onUnlocked();
      }
    }
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.log('Destroying Lock Screen Detector');
    if (this.wakeLockSentinel) {
      this.wakeLockSentinel.release();
    }
    if (this.screenListener) {
      window.removeEventListener('orientationchange', this.screenListener);
    }
  }
}

export const lockScreenDetector = new LockScreenDetector();
