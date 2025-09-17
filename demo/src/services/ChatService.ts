import { MessageService, withMessages, Message } from '@d-buckner/steward'

export interface ChatMessage {
  id: string
  text: string
  author: string
  timestamp: number
  type: 'user' | 'system' | 'bot'
}

interface ChatState {
  messages: ChatMessage[]
  currentUser: string
  isTyping: boolean
  onlineUsers: string[]
  lastActivity: number
}

interface ChatMessages {
  SEND_MESSAGE: { text: string }
  SET_USER: { username: string }
  START_TYPING: {}
  STOP_TYPING: {}
  USER_JOIN: { username: string }
  USER_LEAVE: { username: string }
  SIMULATE_BOT_RESPONSE: {}
  CLEAR_CHAT: {}
}

@withMessages<ChatMessages>([
  'SEND_MESSAGE',
  'SET_USER',
  'START_TYPING',
  'STOP_TYPING', 
  'USER_JOIN',
  'USER_LEAVE',
  'SIMULATE_BOT_RESPONSE',
  'CLEAR_CHAT'
], {
  SEND_MESSAGE: (text: string) => ({ text }),
  SET_USER: (username: string) => ({ username }),
  START_TYPING: () => ({}),
  STOP_TYPING: () => ({}),
  USER_JOIN: (username: string) => ({ username }),
  USER_LEAVE: (username: string) => ({ username }),
  SIMULATE_BOT_RESPONSE: () => ({}),
  CLEAR_CHAT: () => ({})
})
export class ChatService extends MessageService<ChatState, ChatMessages> {
  private typingTimer?: number

  constructor() {
    super({
      messages: [
        {
          id: '1',
          text: 'Welcome to the Steward Chat Demo! 🎉',
          author: 'System',
          timestamp: Date.now() - 5000,
          type: 'system'
        }
      ],
      currentUser: 'Guest',
      isTyping: false,
      onlineUsers: ['Guest'],
      lastActivity: Date.now()
    })
  }

  async handle<K extends keyof ChatMessages>(
    message: Message<ChatMessages, K>
  ): Promise<void> {
    switch (message.type) {
      case 'SEND_MESSAGE': {
        const { text } = message.payload as ChatMessages['SEND_MESSAGE']
        
        if (!text.trim()) return
        
        const newMessage: ChatMessage = {
          id: Date.now().toString(),
          text: text.trim(),
          author: this.state.currentUser,
          timestamp: Date.now(),
          type: 'user'
        }
        
        this.setState('messages', [...this.state.messages, newMessage])
        this.setState('lastActivity', Date.now())
        this.setState('isTyping', false)
        
        // Auto-trigger bot response for demo
        if (text.toLowerCase().includes('bot') || text.includes('?')) {
          setTimeout(() => this.send('SIMULATE_BOT_RESPONSE', {}), 1000 + Math.random() * 2000)
        }
        break
      }

      case 'SET_USER': {
        const { username } = message.payload as ChatMessages['SET_USER']
        const trimmedName = username.trim() || 'Guest'
        
        if (trimmedName !== this.state.currentUser) {
          // Add system message about name change
          const systemMessage: ChatMessage = {
            id: Date.now().toString(),
            text: `${this.state.currentUser} is now known as ${trimmedName}`,
            author: 'System',
            timestamp: Date.now(),
            type: 'system'
          }
          
          this.setState('messages', [...this.state.messages, systemMessage])
          this.setState('currentUser', trimmedName)
          
          // Update online users
          const newOnlineUsers = this.state.onlineUsers.map(user => 
            user === this.state.currentUser ? trimmedName : user
          )
          this.setState('onlineUsers', newOnlineUsers)
        }
        break
      }

      case 'START_TYPING': {
        this.setState('isTyping', true)
        
        // Clear existing timer
        if (this.typingTimer) {
          clearTimeout(this.typingTimer)
        }
        
        // Auto-stop typing after 3 seconds
        this.typingTimer = window.setTimeout(() => {
          this.send('STOP_TYPING', {})
        }, 3000)
        break
      }

      case 'STOP_TYPING': {
        this.setState('isTyping', false)
        if (this.typingTimer) {
          clearTimeout(this.typingTimer)
          this.typingTimer = undefined
        }
        break
      }

      case 'USER_JOIN': {
        const { username } = message.payload as ChatMessages['USER_JOIN']
        
        if (!this.state.onlineUsers.includes(username)) {
          const joinMessage: ChatMessage = {
            id: Date.now().toString(),
            text: `${username} joined the chat`,
            author: 'System',
            timestamp: Date.now(),
            type: 'system'
          }
          
          this.setState('messages', [...this.state.messages, joinMessage])
          this.setState('onlineUsers', [...this.state.onlineUsers, username])
        }
        break
      }

      case 'USER_LEAVE': {
        const { username } = message.payload as ChatMessages['USER_LEAVE']
        
        const leaveMessage: ChatMessage = {
          id: Date.now().toString(),
          text: `${username} left the chat`,
          author: 'System',
          timestamp: Date.now(),
          type: 'system'
        }
        
        this.setState('messages', [...this.state.messages, leaveMessage])
        this.setState('onlineUsers', this.state.onlineUsers.filter(user => user !== username))
        break
      }

      case 'SIMULATE_BOT_RESPONSE': {
        // Simulate typing first
        this.setState('isTyping', true)
        
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500))
        
        const responses = [
          "That's interesting! Tell me more.",
          "I'm just a demo bot, but I think you're onto something! 🤖",
          "Have you tried exploring the other demo features?",
          "The message-driven architecture is pretty cool, right?",
          "Check out how the strongly typed state proxy works!",
          "SolidJS + Steward = ❤️",
          "Try the counter demo too - it shows off the reactive updates!"
        ]
        
        const botMessage: ChatMessage = {
          id: Date.now().toString(),
          text: responses[Math.floor(Math.random() * responses.length)],
          author: 'DemoBot',
          timestamp: Date.now(),
          type: 'bot'
        }
        
        this.setState('messages', [...this.state.messages, botMessage])
        this.setState('isTyping', false)
        break
      }

      case 'CLEAR_CHAT': {
        const welcomeMessage: ChatMessage = {
          id: Date.now().toString(),
          text: 'Chat cleared! Welcome back! 👋',
          author: 'System',
          timestamp: Date.now(),
          type: 'system'
        }
        
        this.setState('messages', [welcomeMessage])
        this.setState('lastActivity', Date.now())
        break
      }
    }
  }

  // Computed properties using strongly typed state
  getRecentMessages(limit: number = 50) {
    return this.state.messages.slice(-limit)
  }

  getMessageStats() {
    const { messages } = this.state
    const userMessages = messages.filter(m => m.type === 'user')
    const systemMessages = messages.filter(m => m.type === 'system') 
    const botMessages = messages.filter(m => m.type === 'bot')
    
    return {
      total: messages.length,
      user: userMessages.length,
      system: systemMessages.length,
      bot: botMessages.length,
      averageLength: userMessages.reduce((sum, msg) => sum + msg.text.length, 0) / (userMessages.length || 1)
    }
  }

  cleanup() {
    if (this.typingTimer) {
      clearTimeout(this.typingTimer)
    }
  }

}