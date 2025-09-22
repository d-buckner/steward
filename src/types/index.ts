export type EventHandler<T = any> = (data: T) => void | Promise<void>

export interface EventSubscription {
  unsubscribe(): void
}

export interface EventBus {
  on<T = any>(event: string, handler: EventHandler<T>): EventSubscription
  off<T = any>(event: string, handler: EventHandler<T>): void
  once<T = any>(event: string, handler: EventHandler<T>): EventSubscription
  removeAllListeners(event?: string): void
  hasListeners(event: string): boolean
  getListenerCount(event: string): number
  getState(): Record<string, any>
}
