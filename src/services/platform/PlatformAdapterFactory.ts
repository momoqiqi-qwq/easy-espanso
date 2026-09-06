import type { IPlatformAdapter } from './IPlatformAdapter';
import { TauriAdapter } from './TauriAdapter';
import { WebAdapter } from './WebAdapter';

export class PlatformAdapterFactory {
  private static instance: IPlatformAdapter | null = null;

  public static getInstance(): IPlatformAdapter {
    if (!this.instance) this.instance = this.createAdapter();
    return this.instance;
  }

  private static createAdapter(): IPlatformAdapter {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      try {
        console.log('[PlatformAdapterFactory] Using TauriAdapter');
        return new TauriAdapter();
      } catch (error) {
        console.error('[PlatformAdapterFactory] Failed to create TauriAdapter:', error);
      }
    }
    console.warn('[PlatformAdapterFactory] Tauri runtime not detected; using WebAdapter');
    return new WebAdapter();
  }
}
