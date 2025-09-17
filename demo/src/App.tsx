import { ServiceContainer } from '@d-buckner/steward'
import { ServiceProvider } from '@d-buckner/steward-solid'
import { createSignal, For, Show } from 'solid-js'

import { CounterService, TodoService, ChatService, CounterToken, TodoToken, ChatToken } from './services'
import { CounterDemo } from './components/CounterDemo'
import { TodoDemo } from './components/TodoDemo'
import { ChatDemo } from './components/ChatDemo'

import './styles.css'

// Create container and register services
const container = new ServiceContainer()
container.register(CounterToken, CounterService)
container.register(TodoToken, TodoService)
container.register(ChatToken, ChatService)

type DemoTab = 'counter' | 'todos' | 'chat'

const demos = [
  { 
    id: 'counter' as DemoTab, 
    title: 'Counter', 
    emoji: '🔢',
    description: 'Strongly typed state proxy & reactive updates'
  },
  { 
    id: 'todos' as DemoTab, 
    title: 'Todo List', 
    emoji: '📝',
    description: 'Message-driven architecture & expressive APIs'
  },
  { 
    id: 'chat' as DemoTab, 
    title: 'Chat', 
    emoji: '💬',
    description: 'Real-time messaging & async operations'
  }
]

function App() {
  const [activeTab, setActiveTab] = createSignal<DemoTab>('counter')
  const [showInfo, setShowInfo] = createSignal(false)

  const renderDemo = () => {
    switch (activeTab()) {
      case 'counter': return <CounterDemo />
      case 'todos': return <TodoDemo />
      case 'chat': return <ChatDemo />
      default: return <CounterDemo />
    }
  }

  return (
    <ServiceProvider container={container}>
      <div class="app">
        <header class="app-header">
          <div class="header-content">
            <h1 class="app-title">
              ⚡ Steward + SolidJS Demo
            </h1>
            <p class="app-subtitle">
              Interactive showcase of service-based architecture with dependency injection
            </p>
            
            <button 
              class="info-btn"
              onClick={() => setShowInfo(true)}
            >
              ℹ️ About
            </button>
          </div>
        </header>

        <nav class="demo-tabs">
          <For each={demos}>
            {(demo) => (
              <button
                class="tab-btn"
                classList={{ active: activeTab() === demo.id }}
                onClick={() => setActiveTab(demo.id)}
              >
                <span class="tab-emoji">{demo.emoji}</span>
                <div class="tab-content">
                  <span class="tab-title">{demo.title}</span>
                  <span class="tab-desc">{demo.description}</span>
                </div>
              </button>
            )}
          </For>
        </nav>

        <main class="demo-content">
          {renderDemo()}
        </main>

        <footer class="app-footer">
          <p>
            Built with ❤️ using{' '}
            <a href="https://github.com/d-buckner/steward" target="_blank">Steward</a> and{' '}
            <a href="https://solidjs.com" target="_blank">SolidJS</a>
          </p>
          <p class="tech-stack">
            🎯 Strongly typed • 🚀 Reactive • 📨 Message-driven • 💉 Dependency injection
          </p>
        </footer>

        <Show when={showInfo()}>
          <div class="modal-overlay" onClick={() => setShowInfo(false)}>
            <div class="info-modal" onClick={(e) => e.stopPropagation()}>
              <div class="modal-header">
                <h2>About Steward</h2>
                <button onClick={() => setShowInfo(false)} class="close-btn">❌</button>
              </div>
              
              <div class="modal-body">
                <p>
                  <strong>Steward</strong> is a service-based architecture library for frontend applications
                  that provides:
                </p>
                
                <ul class="feature-list">
                  <li>
                    <strong>🎯 Strongly Typed State Proxy:</strong> Access state with full TypeScript IntelliSense
                    using <code>service.state.property</code>
                  </li>
                  <li>
                    <strong>📨 Message-driven Architecture:</strong> Pure message handlers with location transparency
                    using <code>@withMessages</code> decorator
                  </li>
                  <li>
                    <strong>🚀 Push-based Reactivity:</strong> State updates propagate through event system
                    with fine-grained SolidJS primitives
                  </li>
                  <li>
                    <strong>💉 Dependency Injection:</strong> Type-safe service container with automatic resolution
                  </li>
                  <li>
                    <strong>🎨 Framework Integrations:</strong> React hooks and SolidJS primitives
                  </li>
                  <li>
                    <strong>🤝 Collaboration Ready:</strong> Built-in CRDT support with Automerge
                  </li>
                </ul>
                
                <div class="demo-explanation">
                  <h3>Demo Features</h3>
                  <ul>
                    <li><strong>Counter:</strong> Shows reactive state updates and strongly typed access</li>
                    <li><strong>Todo List:</strong> Demonstrates message-driven architecture and expressive APIs</li>
                    <li><strong>Chat:</strong> Real-time messaging with async operations and complex state</li>
                  </ul>
                </div>
                
                <div class="code-example">
                  <h4>Example Service Usage:</h4>
                  <pre><code>{`// Service definition
class CounterService extends Service {
  increment() {
    // Strongly typed state access
    this.setState('count', this.state.count + 1)
  }
}

// SolidJS component usage  
function Counter() {
  const count = createServiceState(CounterToken, 'count')
  const actions = createServiceActions(CounterToken)
  
  return (
    <button onClick={actions.increment}>
      Count: {count()}
    </button>
  )
}`}</code></pre>
                </div>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </ServiceProvider>
  )
}

export default App