import { Service } from './Service'
import { 
  MessageDefinition, 
  Message, 
  MessageHandler, 
  createMessage, 
  generateMessageId 
} from './Messages'

export abstract class MessageService<
  State extends Record<string, any>,
  Messages extends MessageDefinition
> extends Service<State> implements MessageHandler<Messages> {
  
  private messageHistory: Message<Messages>[] = []
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void
    reject: (error: Error) => void
    responseType: keyof Messages
    timeout: NodeJS.Timeout
  }>()

  abstract handle<K extends keyof Messages>(
    message: Message<Messages, K>
  ): Promise<void> | void

  // Send message to this service
  async send<K extends keyof Messages>(
    type: K,
    payload: Messages[K],
    correlationId?: string
  ): Promise<void> {
    const message = createMessage<Messages, K>(type, payload, correlationId)
    
    // Store in history for debugging
    this.messageHistory.push(message as Message<Messages>)
    
    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${this.constructor.name}] Handling message:`, message)
    }
    
    try {
      await this.handle(message)
    } catch (error) {
      console.error(`[${this.constructor.name}] Message handling error:`, error)
      throw error
    }
  }

  // Request/response pattern
  async request<
    ReqKey extends keyof Messages,
    ResKey extends keyof Messages
  >(
    requestType: ReqKey,
    payload: Messages[ReqKey],
    responseType: ResKey,
    timeout = 5000
  ): Promise<Messages[ResKey]> {
    const correlationId = generateMessageId()
    
    return new Promise<Messages[ResKey]>((resolve, reject) => {
      // Set up response listener
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(correlationId)
        reject(new Error(`Request timeout: ${String(requestType)}`))
      }, timeout)
      
      this.pendingRequests.set(correlationId, {
        resolve,
        reject,
        responseType,
        timeout: timeoutHandle
      })
      
      // Send the request
      this.send(requestType, payload, correlationId).catch(reject)
    })
  }

  // Handle response messages for pending requests
  protected resolveRequest<K extends keyof Messages>(
    type: K,
    payload: Messages[K],
    correlationId: string
  ): void {
    const pending = this.pendingRequests.get(correlationId)
    if (pending && pending.responseType === type) {
      clearTimeout(pending.timeout)
      this.pendingRequests.delete(correlationId)
      pending.resolve(payload)
    }
  }

  // Get message history for debugging
  getMessageHistory(): Message<Messages>[] {
    return [...this.messageHistory]
  }

  // Clear message history
  clearMessageHistory(): void {
    this.messageHistory = []
  }

  // Replay messages from history
  async replayMessages(fromIndex = 0): Promise<void> {
    const messages = this.messageHistory.slice(fromIndex)
    for (const message of messages) {
      await this.handle(message as any)
    }
  }

  // Clean up pending requests on disposal
  override clear(): void {
    super.clear()
    
    // Reject all pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Service disposed'))
    }
    this.pendingRequests.clear()
    this.messageHistory = []
  }
}