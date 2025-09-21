import { ServiceContainer } from '@d-buckner/steward'
import {
  CounterService,
  TodoService,
  ChatService,
  DataProcessingService,
  CounterToken,
  TodoToken,
  ChatToken,
  DataProcessingToken
} from '../services'

/**
 * Demo ServiceContainer - shows proper pattern for consumer applications
 *
 * In a real app, this would be where you configure all your services in one place.
 * The container automatically handles worker services via @withWorker decorator detection.
 */
export class DemoServiceContainer extends ServiceContainer {
  constructor() {
    super()
    this.registerDemoServices()
  }

  private registerDemoServices(): void {
    // Register all demo services with their tokens
    this.register(CounterToken, CounterService)
    this.register(TodoToken, TodoService)
    this.register(ChatToken, ChatService)
    this.register(DataProcessingToken, DataProcessingService) // ← Worker service handled automatically!
  }
}