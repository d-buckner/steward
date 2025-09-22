import type { ServiceContainer } from './ServiceContainer';
import type { TypedServiceToken, StateFromToken } from './ServiceTokens';

/**
 * Simple state observer for one-off state monitoring
 */
export class ServiceStateObserver<T extends TypedServiceToken> {
  constructor(
    private container: ServiceContainer,
    private serviceToken: T
  ) {}

  /**
   * Wait for a specific state condition to be true
   */
  async waitFor<K extends keyof StateFromToken<T>>(
    key: K,
    predicate: (value: StateFromToken<T>[K]) => boolean,
    timeout?: number
  ): Promise<StateFromToken<T>[K]> {
    const service = this.container.resolve(this.serviceToken);
    const currentValue = service.state[key as string];
    
    // Check if condition is already met
    if (predicate(currentValue)) {
      return currentValue;
    }

    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | undefined;
      
      if (timeout) {
        timeoutId = setTimeout(() => {
          subscription.unsubscribe();
          reject(new Error(`Timeout waiting for condition on ${String(key)}`));
        }, timeout);
      }

      const subscription = service.on(key as string, (value: StateFromToken<T>[K]) => {
        if (predicate(value)) {
          subscription.unsubscribe();
          if (timeoutId) clearTimeout(timeoutId);
          resolve(value);
        }
      });
    });
  }

  /**
   * Get a one-time snapshot of current state
   */
  snapshot(): StateFromToken<T> {
    const service = this.container.resolve(this.serviceToken);
    return service.getState() as StateFromToken<T>;
  }
}
