import { createServiceToken } from '@d-buckner/steward'
import { CounterService } from './CounterService'
import { TodoService } from './TodoService'
import { ChatService } from './ChatService'
import { DataProcessingService, DataProcessingToken, INITIAL_DATA_PROCESSING_STATE } from './DataProcessingService'

// Export services
export { CounterService, TodoService, ChatService, DataProcessingService, INITIAL_DATA_PROCESSING_STATE }

// Create service tokens
export const CounterToken = createServiceToken<CounterService>('counter')
export const TodoToken = createServiceToken<TodoService>('todos')
export const ChatToken = createServiceToken<ChatService>('chat')

// Export DataProcessingToken from its own file
export { DataProcessingToken }

// Type augmentation for service registry
declare module '@d-buckner/steward' {
  interface ServiceRegistry {
    counter: CounterService
    todos: TodoService
    chat: ChatService
    dataProcessing: DataProcessingService
  }
}