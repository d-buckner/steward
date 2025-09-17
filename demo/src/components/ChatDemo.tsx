import { createServiceState, createServiceActions } from '@d-buckner/steward-solid'
import { createSignal, createMemo, createEffect, For, Show, onCleanup } from 'solid-js'
import { ChatToken } from '../services'

export function ChatDemo() {
  const messages = createServiceState(ChatToken, 'messages')
  const currentUser = createServiceState(ChatToken, 'currentUser')
  const isTyping = createServiceState(ChatToken, 'isTyping')
  const onlineUsers = createServiceState(ChatToken, 'onlineUsers')
  
  const actions = createServiceActions(ChatToken)
  
  const [messageText, setMessageText] = createSignal('')
  const [usernameInput, setUsernameInput] = createSignal('')
  const [showUserModal, setShowUserModal] = createSignal(false)
  
  let messagesContainer: HTMLDivElement | undefined
  let messageInput: HTMLInputElement | undefined
  
  // Auto-scroll to bottom when new messages arrive
  createEffect(() => {
    const messageList = messages()
    if (messageList && messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight
    }
  })
  
  // Handle typing indicators
  let typingTimer: number | undefined
  const handleTyping = () => {
    if (!isTyping()) {
      actions.startTyping()
    }
    
    if (typingTimer) {
      clearTimeout(typingTimer)
    }
    
    typingTimer = window.setTimeout(() => {
      actions.stopTyping()
    }, 1000)
  }
  
  onCleanup(() => {
    if (typingTimer) {
      clearTimeout(typingTimer)
    }
  })
  
  const sendMessage = () => {
    const text = messageText().trim()
    if (!text) return
    
    actions.sendMessage(text)
    setMessageText('')
    actions.stopTyping()
    
    if (messageInput) {
      messageInput.focus()
    }
  }
  
  const changeUsername = () => {
    const newName = usernameInput().trim()
    if (newName && newName !== currentUser()) {
      actions.setUser(newName)
      setShowUserModal(false)
      setUsernameInput('')
    }
  }
  
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }
  
  const getMessageClass = (messageType: string, author: string) => {
    const classes = ['message']
    
    if (messageType === 'system') classes.push('system')
    else if (messageType === 'bot') classes.push('bot')
    else if (author === currentUser()) classes.push('own')
    else classes.push('other')
    
    return classes.join(' ')
  }
  
  // Computed stats
  const stats = createMemo(() => {
    const messageList = messages() || []
    const userMessages = messageList.filter(m => m.type === 'user')
    const systemMessages = messageList.filter(m => m.type === 'system') 
    const botMessages = messageList.filter(m => m.type === 'bot')
    
    return {
      total: messageList.length,
      user: userMessages.length,
      system: systemMessages.length,
      bot: botMessages.length,
      onlineCount: onlineUsers()?.length || 0
    }
  })

  return (
    <div class="demo-section">
      <h2>💬 Chat Demo</h2>
      <p class="demo-description">
        Shows real-time messaging with message-driven architecture, 
        async operations, and complex state interactions.
      </p>
      
      <div class="chat-container">
        <div class="chat-header">
          <div class="user-info">
            <span class="current-user">👤 {currentUser()}</span>
            <button 
              class="change-user-btn"
              onClick={() => {
                setUsernameInput(currentUser() || '')
                setShowUserModal(true)
              }}
            >
              ✏️ Change
            </button>
          </div>
          
          <div class="chat-stats">
            <span class="stat">📊 {stats().total} messages</span>
            <span class="stat">👥 {stats().onlineCount} online</span>
          </div>
          
          <button 
            class="clear-chat-btn"
            onClick={() => actions.clearChat()}
          >
            🗑️ Clear
          </button>
        </div>
        
        <div class="messages-container" ref={messagesContainer}>
          <For each={messages()}>
            {(message) => (
              <div class={getMessageClass(message.type, message.author)}>
                <div class="message-header">
                  <span class="author">{message.author}</span>
                  <span class="timestamp">{formatTime(message.timestamp)}</span>
                </div>
                <div class="message-content">{message.text}</div>
              </div>
            )}
          </For>
          
          <Show when={isTyping()}>
            <div class="typing-indicator">
              <span class="typing-text">{currentUser()} is typing</span>
              <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </Show>
        </div>
        
        <div class="message-input-container">
          <input
            ref={messageInput}
            type="text"
            placeholder={`Message as ${currentUser()}...`}
            value={messageText()}
            onInput={(e) => {
              setMessageText(e.target.value)
              handleTyping()
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                sendMessage()
              }
            }}
            class="message-input"
          />
          
          <button 
            onClick={sendMessage}
            disabled={!messageText().trim()}
            class="send-btn"
          >
            📤 Send
          </button>
        </div>
        
        <div class="chat-suggestions">
          <p>💡 Try typing messages with "bot" or "?" to trigger bot responses!</p>
        </div>
      </div>
      
      <Show when={showUserModal()}>
        <div class="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div class="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Change Username</h3>
            <input
              type="text"
              placeholder="Enter new username"
              value={usernameInput()}
              onInput={(e) => setUsernameInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') changeUsername()
                if (e.key === 'Escape') setShowUserModal(false)
              }}
              class="username-input"
              ref={(el) => el.focus()}
            />
            <div class="modal-actions">
              <button onClick={changeUsername} class="save-btn">
                💾 Save
              </button>
              <button onClick={() => setShowUserModal(false)} class="cancel-btn">
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      </Show>
      
      <div class="message-stats">
        <h4>📈 Message Statistics</h4>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">User Messages:</span>
            <span class="stat-value">{stats().user}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Bot Messages:</span>
            <span class="stat-value">{stats().bot}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">System Messages:</span>
            <span class="stat-value">{stats().system}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Online Users:</span>
            <span class="stat-value">{stats().onlineCount}</span>
          </div>
        </div>
      </div>
    </div>
  )
}