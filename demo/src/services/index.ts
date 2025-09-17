import { createServiceToken } from '@d-buckner/steward'
import { CounterService } from './CounterService'
import { TodoService } from './TodoService' 
import { ChatService } from './ChatService'

// Export services
export { CounterService, TodoService, ChatService }

// Create service tokens
export const CounterToken = createServiceToken<CounterService>('counter')
export const TodoToken = createServiceToken<TodoService>('todos')
export const ChatToken = createServiceToken<ChatService>('chat')

// Type augmentation for service registry
declare module '@d-buckner/steward' {
  interface ServiceRegistry {
    counter: CounterService
    todos: TodoService
    chat: ChatService
  }
}