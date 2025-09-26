import {
  createMessage,
  generateMessageId
} from './Messages';
import { ServiceEventBus } from './ServiceEventBus';
import { getWorkerOptions } from './WorkerDecorator';
import { encode, decode } from './MessageCodec';
import type {
  Message} from './Messages';
import type { EventBus, EventHandler, EventSubscription } from '../types';
import type { ServiceActions } from './ServiceTypes';

type WorkerMessage<T = unknown> =
  | { type: 'INIT_SERVICE'; id?: string; serviceName?: string; initialState?: T }
  | { type: 'SERVICE_MESSAGE'; id: string; messageType: string; payload: T };

/**
 * Message-driven service with reactive state management
 *
 * Services organize business logic into isolated processes that communicate through messages.
 * This design enables location transparency, fault isolation, and seamless scaling.
 *
 * @example Basic Service
 * ```typescript
 * interface CounterState extends ServiceState {
 *   count: number
 *   error: 'OVERFLOW' | null
 * }
 *
 * class CounterService extends Service<CounterState> {
 *   constructor() {
 *     super({ count: 0, error: null })
 *   }
 *
 *   increment() {
 *     if (this.state.count >= 100) {
 *       this.setState('error', 'OVERFLOW')
 *       return
 *     }
 *     this.setState('count', this.state.count + 1)
 *   }
 *
 *   reset() {
 *     this.setState({ count: 0, error: null })
 *   }
 * }
 * ```
 *
 * @example Worker Service
 * ```typescript
 * @withWorker('DataProcessor')
 * class DataProcessingService extends Service<DataState> {
 *   // Heavy computation runs in dedicated worker thread
 *   processLargeDataset(data: any[]) {
 *     // CPU-intensive work won't block UI
 *     const result = this.runComplexAnalysis(data)
 *     this.setState('result', result)
 *   }
 * }
 * ```
 *
 * @template TState - The service's state interface, must extend Record<string, any>
 * @template Actions - The service's action interface, defaults to ServiceActions
 */
export class Service<
  TState extends Record<string, any> = Record<string, any>,
  Actions extends ServiceActions = ServiceActions,
> implements EventBus {
  /**
   * List of base Service methods that should not be exposed as actions
   * This is the single source of truth - update this list when adding new base methods
   */
  static readonly BASE_METHODS = new Set([
    'setState', 'setStates', 'updateState', 'emit', 'on', 'off', 'once',
    'removeAllListeners', 'hasListeners', 'getListenerCount', 'getState',
    'handle', 'clear', 'getWorker',
    'getMessageHistory', 'clearMessageHistory', 'replayMessages'
  ]);

  private eventBus = new ServiceEventBus<TState>();
  private _state: TState;
  private messageHistory: Message<Actions>[] = [];
  private messageRouter: ((message: Message<any>) => Promise<void> | void) | null = null;

  // Worker communication properties
  private worker?: Worker;
  private isInWorker: boolean;
  private isWorkerService: boolean;
  private resolveInit?: () => void;
  private rejectInit?: (error: Error) => void;

  /**
   * Strongly typed reactive state proxy
   * Access state properties directly: service.state.count
   */
  public readonly state: TState;

  /**
   * Creates a new service instance with initial state
   *
   * @param initialState - The initial state for this service
   *
   * @example
   * ```typescript
   * constructor() {
   *   super({
   *     count: 0,
   *     loading: false,
   *     error: null
   *   })
   * }
   * ```
   */
  constructor(initialState: TState) {
    this._state = { ...initialState };

    // Detect execution context
    this.isInWorker = typeof (globalThis as any).WorkerGlobalScope !== 'undefined' &&
                      typeof (globalThis as any).importScripts === 'function';
    this.isWorkerService = !!(this.constructor as any).__isWorkerService;



    // Create reactive state proxy
    this.state = new Proxy(this._state, {
      get: (target, prop: string | symbol) => {
        if (typeof prop === 'string') {
          return this.eventBus.get(prop as keyof TState);
        }
        return target[prop as keyof TState];
      },
      set: () => {
        throw new Error('Cannot directly modify service state. Use setState() or updateState() instead.');
      }
    }) as TState;

    // Set up based on context
    if (this.isWorkerService && !this.isInWorker) {
      // Main thread: set up worker communication
      this.setupWorkerBridge();
    } else {
      // Worker thread OR normal service: run locally
      this.setupLocal(initialState);
    }
  }

  /**
   * Create an automatic message router that maps message types to public methods
   */
  private createAutoMessageRouter(): (message: Message<any>) => Promise<void> | void {
    return (message: Message<any>) => {
      const methodName = message.type as string;
      const method = (this as any)[methodName];

      if (typeof method === 'function') {
        // Apply the message payload as arguments
        return method.apply(this, message.payload as any[]);
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[${this.constructor.name}] No method found for message type: ${String(message.type)}`);
        }
      }
    };
  }

  // EventBus interface implementation
  on<T = any>(event: string, handler: EventHandler<T>): EventSubscription {
    return this.eventBus.on(event as keyof TState, handler);
  }
  
  off<T = any>(event: string, handler: EventHandler<T>): void {
    this.eventBus.off(event as keyof TState, handler);
  }
  
  once<T = any>(event: string, handler: EventHandler<T>): EventSubscription {
    return this.eventBus.once(event as keyof TState, handler);
  }
  
  removeAllListeners(event?: string): void {
    this.eventBus.removeAllListeners(event as keyof TState);
  }
  
  hasListeners(event: string): boolean {
    return this.eventBus.hasListeners(event as keyof TState);
  }
  
  getListenerCount(event: string): number {
    return this.eventBus.getListenerCount(event as keyof TState);
  }
  
  /**
   * Update multiple state properties at once
   * Convenience method that calls setStates internally
   */
  protected updateState(updates: Partial<TState>): void {
    this.setStates(updates);
  }
  
  public getState(): Record<string, any> {
    return this.eventBus.getState();
  }
  
  /**
   * Set a single state property and emit change event
   *
   * Updates the state and notifies all subscribers of the change.
   * Works seamlessly whether service runs locally or in a worker.
   *
   * @param key - The state property to update
   * @param value - The new value for the property
   *
   * @example
   * ```typescript
   * // Update a single property
   * this.setState('count', 42)
   * this.setState('loading', false)
   * this.setState('error', 'NETWORK_TIMEOUT')
   * ```
   */
  protected setState<K extends keyof TState>(key: K, value: TState[K]): void {
    this._state[key] = value;

    if (this.isInWorker) {
      // In worker: send state change to main thread via postMessage
      this.postMessage({
        type: 'STATE_CHANGE',
        key,
        value
      });
    } else {
      // In main thread: emit locally to eventBus
      this.eventBus.emit(key, value);
    }
  }

  /**
   * Set multiple state properties and emit change events
   *
   * Efficiently updates multiple state properties at once.
   * Each property change emits its own event for fine-grained reactivity.
   *
   * @param updates - Object containing the state properties to update
   *
   * @example
   * ```typescript
   * // Update multiple properties at once
   * this.setStates({
   *   loading: false,
   *   data: processedData,
   *   error: null
   * })
   * ```
   */
  protected setStates(updates: Partial<TState>): void {
    Object.entries(updates).forEach(([key, value]) => {
      this._state[key as keyof TState] = value;

      if (this.isInWorker) {
        // In worker: send state change to main thread via postMessage
        this.postMessage({
          type: 'STATE_CHANGE',
          key,
          value
        });
      } else {
        // In main thread: emit locally to eventBus
        this.eventBus.emit(key as keyof TState, value);
      }
    });
  }

  // Message handling interface - uses decorator-based routing or can be overridden
  private handle<K extends keyof Actions>(
    message: Message<Actions, K>
  ): Promise<void> | void {
    if (this.messageRouter) {
      return this.messageRouter(message as Message<Actions>);
    }

    // This should not happen anymore with automatic routing
    if (process.env.NODE_ENV === 'development') {
      console.warn(`No message router found for service ${this.constructor.name}. This should not happen.`);
    }
  }

  // Send message to this service
  send<K extends keyof Actions>(
    type: K,
    payload: Actions[K]
  ): void {
    if (this.isWorkerService && !this.isInWorker && this.worker) {
      // Main thread of worker service: forward to worker
      const id = generateMessageId();

      this.worker.postMessage({
        type: 'SERVICE_MESSAGE',
        id,
        messageType: type,
        payload: Array.isArray(payload) ? payload : [payload]
      });
      return;
    }

    // Local execution (worker thread or normal service)
    const message = createMessage<Actions, K>(type, payload);

    // Store in history for debugging
    this.messageHistory.push(message as Message<Actions>);

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${this.constructor.name}] Queuing message:`, message);
    }

    try {
      const result = this.handle(message);

      // If handle returns a Promise, we could log a warning about async handlers
      if (result instanceof Promise) {
        console.warn(`[${this.constructor.name}] Async handle() detected but send() is synchronous. Consider using sendAsync() when available.`);
        // For now, we'll let the Promise resolve in the background but catch rejections
        result.catch(error => {
          console.error(`[${this.constructor.name}] Async message handling error:`, error);
        });
      }
    } catch (error) {
      console.error(`[${this.constructor.name}] Message handling error:`, error);
      throw error;
    }
  }

  // Get message history for debugging
  getMessageHistory(): Message<Actions>[] {
    return [...this.messageHistory];
  }


  // Clear message history
  clearMessageHistory(): void {
    this.messageHistory = [];
  }

  // Replay messages from history
  async replayMessages(fromIndex = 0): Promise<void> {
    const messages = this.messageHistory.slice(fromIndex);
    for (const message of messages) {
      await this.handle(message as any);
    }
  }
  
  /**
   * Set up service for local execution (worker thread or normal service)
   */
  private setupLocal(initialState: TState): void {
    // Emit initial state for all keys
    Object.entries(initialState).forEach(([key, value]) => {
      this.eventBus.emit(key as keyof TState, value as TState[keyof TState]);
    });

    // Initialize message router with automatic method detection
    this.messageRouter = this.createAutoMessageRouter();

    // If in worker, listen for main thread messages
    if (this.isInWorker) {
      this.setupWorkerMessageHandling();
    }
  }

  /**
   * Set up worker bridge for main thread
   */
  private setupWorkerBridge(): void {
    const workerOptions = getWorkerOptions(this.constructor);
    const workerName = workerOptions.name;

    if (!workerName) {
      throw new Error(`Service '${this.constructor.name}' is decorated with @withWorker but missing worker name`);
    }

    // Derive worker URL from decorator name
    const workerUrl = `/dist/workers/${workerName}.worker.js`;

    // Create worker
    this.worker = new Worker(workerUrl, { type: 'module' });

    // Set up worker communication
    new Promise<void>((resolve, reject) => {
      this.resolveInit = resolve;
      this.rejectInit = reject;
    });

    this.worker.onmessage = this.handleWorkerMessage.bind(this);
    this.worker.onerror = this.handleWorkerError.bind(this);

    // Initialize service in worker
    this.worker.postMessage({
      type: 'INIT_SERVICE',
      serviceName: this.constructor.name,
      initialState: this._state
    });
  }

  /**
   * Send message with messagepack encoding and ArrayBuffer transfer
   */
  private postMessage(message: any): void {
    const encoded = encode(message);
    self.postMessage(encoded, { transfer: [encoded] });
  }

  /**
   * Set up message handling in worker thread
   */
  private setupWorkerMessageHandling(): void {
    self.onmessage = async (event: MessageEvent) => {
      const message = decode<WorkerMessage<Actions[keyof Actions]>>(event.data);

      try {
        switch (message.type) {
          case 'INIT_SERVICE':
            // Service already initialized, just confirm
            this.postMessage({
              type: 'INIT_SERVICE',
              id: message.id,
              success: true
            });
            break;

          case 'SERVICE_MESSAGE': {
            const { messageType, payload } = message;
            // Handle method call
            const result = await this.handle(createMessage(messageType, payload));

            this.postMessage({
              type: 'MESSAGE_RESPONSE',
              id: message.id,
              result
            });
            break;
          }
        }
      } catch (error) {
        this.postMessage({
          type: 'MESSAGE_RESPONSE',
          id: message.id,
          error: (error as Error).message
        });
      }
    };
  }

  /**
   * Handle messages from worker
   */
  private handleWorkerMessage(event: MessageEvent): void {
    const { type, key, value } = event.data;

    switch (type) {
      case 'STATE_CHANGE':
        // Forward state change to local event bus
        this.eventBus.emit(key as keyof TState, value);
        break;


      case 'INIT_SERVICE':
        if (event.data.success) {
          this.resolveInit?.();
        } else {
          this.rejectInit?.(new Error(event.data.error || 'Worker initialization failed'));
        }
        break;
    }
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error('[Service] Worker error:', error);
    this.rejectInit?.(new Error(`Worker error: ${error.message}`));
  }

  /**
   * Get worker instance for ServiceClient communication
   */
  public getWorker(): Worker | undefined {
    return this.worker;
  }

  /**
   * Clear state and events for testing
   */
  public clear(): void {
    this.eventBus.clear();
    this.messageHistory = [];

    // Terminate worker if exists
    if (this.worker) {
      this.worker.terminate();
    }
  }
}
