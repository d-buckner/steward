# Interactive Service Graph Visualization

## Overview

An interactive, real-time visualization system for the Steward service architecture that displays services as nodes, message flows as animated edges, and provides debugging insights into the distributed system behavior.

## Architecture Components

### Service Graph Structure

```typescript
interface ServiceNode {
  id: string
  name: string
  type: 'main' | 'worker' | 'proxy'
  state: Record<string, any>
  position: { x: number, y: number }
  status: 'active' | 'inactive' | 'error'
  workerOptions?: WorkerOptions
}

interface MessageEdge {
  id: string
  source: string
  target: string
  messageType: string
  payload: any
  timestamp: number
  correlationId?: string
  direction: 'send' | 'response'
  status: 'pending' | 'success' | 'error' | 'timeout'
}

interface ServiceGraph {
  nodes: Map<string, ServiceNode>
  edges: Map<string, MessageEdge>
  messageHistory: MessageEdge[]
}
```

### Real-Time Message Flow Tracking

#### Message Interception
- Hook into `WorkerProxy.send()` at src/core/WorkerProxy.ts:295
- Intercept `ServiceContainer.resolve()` calls at src/core/ServiceContainer.ts:15
- Monitor worker message handlers at src/core/WorkerProxy.ts:152

#### Message Lifecycle Visualization
1. **Message Creation**: Show message originating from source service
2. **Message Transit**: Animate edge from source to target with payload preview
3. **Processing**: Highlight target node during message handling
4. **Response**: Show return path with response data
5. **State Changes**: Update node state representation when state changes occur

### Visualization Features

#### Interactive Service Nodes
- **Service Cards**: Display service name, type (main/worker/proxy), current state
- **State Inspector**: Expandable view showing detailed service state
- **Message Queue**: Show pending messages in service queues
- **Performance Metrics**: CPU usage, message processing time, error rates

#### Animated Message Flows
- **Message Trails**: Animated particles flowing along edges
- **Message Bubbles**: Hoverable elements showing message type and payload
- **Correlation Tracking**: Group related messages by correlationId
- **Flow Timing**: Speed of animation reflects actual message timing

#### Debug Controls
- **Time Scrubbing**: Replay message history at different speeds
- **Message Filtering**: Filter by service, message type, or time range
- **Breakpoints**: Pause visualization when specific messages are sent
- **State Snapshots**: Capture and compare service states at different points

### Implementation Strategy

#### Phase 1: Core Graph Structure
```typescript
// Service registry integration
class ServiceGraphRegistry {
  private graph = new ServiceGraph()

  registerService(token: TypedServiceToken, instance: any): void {
    const node: ServiceNode = {
      id: token.name,
      name: token.name,
      type: instance instanceof WorkerProxy ? 'proxy' : 'main',
      state: instance.getState(),
      position: this.calculatePosition(token.name),
      status: 'active'
    }
    this.graph.nodes.set(token.name, node)
  }

  trackMessage(message: Message): void {
    // Create edge representation and add to graph
  }
}
```

#### Phase 2: Message Flow Visualization
```typescript
// Message flow tracker
class MessageFlowTracker {
  private messageSubscriptions = new Map<string, EventSubscription>()

  subscribeToService(serviceName: string, proxy: WorkerProxy): void {
    // Hook into proxy.send() to track outgoing messages
    // Monitor proxy message handlers for incoming messages
    // Track state changes via proxy.on() event subscriptions
  }

  visualizeMessageFlow(edge: MessageEdge): void {
    // Create animated SVG/Canvas elements
    // Show message payload in tooltip/inspector
    // Update message status based on response
  }
}
```

#### Phase 3: Interactive Features
```typescript
// Interactive controls and debugging
class GraphDebugger {
  private timelinePosition = 0
  private isPlaying = false

  replayFromTime(timestamp: number): void {
    // Reset graph to state at timestamp
    // Replay messages from that point forward
  }

  setBreakpoint(condition: MessageBreakpointCondition): void {
    // Pause visualization when condition is met
    // Allow inspection of message and service state
  }

  exportDebugSession(): DebugSession {
    // Export complete message history and state snapshots
    // Allow import for later analysis
  }
}
```

### Integration Points

#### ServiceContainer Integration
- Extend `ServiceContainer.resolve()` to register services with graph
- Hook into service instantiation to create initial nodes
- Monitor service disposal to remove nodes

#### WorkerProxy Integration
- Wrap `WorkerProxy.send()` to track outgoing messages
- Intercept `handleWorkerMessage()` to track incoming responses
- Monitor worker initialization and termination events

#### Event Bus Integration
- Subscribe to all service events to track state changes
- Monitor inter-service communication patterns
- Track event propagation chains

### Rendering Technologies

#### SVG-based Implementation
- **Pros**: Crisp scaling, CSS styling, DOM manipulation
- **Cons**: Performance limits with many elements
- **Best for**: < 50 services, detailed debugging views

#### Canvas-based Implementation
- **Pros**: High performance, smooth animations
- **Cons**: Complex hit testing, accessibility challenges
- **Best for**: > 50 services, production monitoring

#### WebGL Implementation
- **Pros**: Maximum performance, 3D capabilities
- **Cons**: Complexity, browser compatibility
- **Best for**: Large-scale systems, 3D service topology

### Debug Use Cases

#### Development Scenarios
1. **Message Race Conditions**: Visualize timing conflicts between services
2. **State Inconsistencies**: Compare expected vs actual service states
3. **Performance Bottlenecks**: Identify slow message processing chains
4. **Error Propagation**: Trace error messages through service hierarchy

#### Production Monitoring
1. **Service Health**: Real-time status of all services
2. **Message Volume**: Identify high-traffic communication patterns
3. **Failure Detection**: Highlight failed messages and timeout scenarios
4. **Performance Trends**: Historical analysis of message processing times

### Configuration Options

```typescript
interface GraphVisualizationConfig {
  layout: 'force-directed' | 'hierarchical' | 'circular' | 'manual'
  nodeSize: 'fixed' | 'proportional-to-state' | 'proportional-to-activity'
  edgeStyle: 'straight' | 'curved' | 'orthogonal'
  animation: {
    enabled: boolean
    speed: number
    showPayloads: boolean
    maxTrailLength: number
  }
  debugging: {
    enableBreakpoints: boolean
    recordHistory: boolean
    maxHistorySize: number
    exportFormat: 'json' | 'har' | 'custom'
  }
}
```

### Cool Factor Features

#### Aesthetic Enhancements
- **Service Glow Effects**: Intensity based on activity level
- **Message Particle Systems**: Different particles for different message types
- **3D Service Topology**: Layered view showing service hierarchies
- **Sound Visualization**: Audio cues for message types and errors

#### Advanced Interactions
- **Graph Manipulation**: Drag services to reorganize layout
- **Zoom & Pan**: Navigate large service graphs smoothly
- **Multi-Selection**: Select and analyze multiple services simultaneously
- **Context Menus**: Right-click actions for debugging operations

#### Data Export & Integration
- **Performance Reports**: Automated analysis of service bottlenecks
- **Message Sequence Diagrams**: Export UML sequence diagrams
- **Grafana Integration**: Embed graphs in monitoring dashboards
- **CI/CD Integration**: Generate service dependency reports

## Production Bundle Exclusion

### Development-Only Integration

#### Environment-Gated Initialization
```typescript
// ServiceContainer.ts
export class ServiceContainer {
  private graphRegistry?: ServiceGraphRegistry

  constructor() {
    // Only initialize visualization in development
    if (process.env.NODE_ENV === 'development' && process.env.STEWARD_DEVTOOLS !== 'false') {
      this.initializeDevtools()
    }
  }

  private async initializeDevtools(): Promise<void> {
    try {
      // Dynamic import prevents bundling in production
      const { ServiceGraphRegistry } = await import('./devtools/ServiceGraphRegistry')
      this.graphRegistry = new ServiceGraphRegistry()
    } catch (error) {
      // Gracefully handle missing devtools in production builds
      console.warn('Steward devtools not available')
    }
  }

  resolve<T extends TypedServiceToken<any>>(token: T): ServiceFromToken<T> {
    const instance = /* ... existing resolution logic ... */

    // Only register with graph in development
    this.graphRegistry?.registerService(token, instance)

    return instance
  }
}
```

#### Conditional WorkerProxy Instrumentation
```typescript
// WorkerProxy.ts
export class WorkerProxy {
  private messageTracker?: MessageFlowTracker

  constructor(serviceClass: any, initialState: TState, options: WorkerOptions) {
    /* ... existing constructor logic ... */

    // Only instrument message tracking in development
    if (process.env.NODE_ENV === 'development') {
      this.initializeMessageTracking()
    }
  }

  private async initializeMessageTracking(): Promise<void> {
    if (typeof window !== 'undefined') {
      try {
        const { MessageFlowTracker } = await import('./devtools/MessageFlowTracker')
        this.messageTracker = new MessageFlowTracker(this.serviceClass.name)
      } catch {
        // Devtools not available
      }
    }
  }

  async send<K extends keyof Actions>(type: K, payload: Actions[K], correlationId?: string): Promise<void> {
    // Track message in development only
    this.messageTracker?.trackOutgoingMessage({ type, payload, correlationId })

    /* ... existing send logic ... */
  }
}
```

### Build System Integration

#### Vite Configuration
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      external: (id) => {
        // Exclude devtools in production builds
        if (process.env.NODE_ENV === 'production' && id.includes('/devtools/')) {
          return true
        }
        return false
      }
    }
  },
  define: {
    // Ensure devtools code is tree-shaken in production
    'process.env.STEWARD_DEVTOOLS': JSON.stringify(process.env.NODE_ENV === 'development')
  }
})
```

#### Webpack Configuration
```javascript
// webpack.config.js
module.exports = {
  resolve: {
    alias: process.env.NODE_ENV === 'production' ? {
      // Replace devtools with no-op implementations in production
      './devtools/ServiceGraphRegistry': path.resolve(__dirname, 'src/devtools/noop.ts'),
      './devtools/MessageFlowTracker': path.resolve(__dirname, 'src/devtools/noop.ts')
    } : {}
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.STEWARD_DEVTOOLS': JSON.stringify(process.env.NODE_ENV === 'development')
    })
  ]
}
```

### File Structure for Bundle Separation

```
src/
├── core/
│   ├── ServiceContainer.ts        # Core with conditional devtools
│   └── WorkerProxy.ts            # Core with conditional tracking
├── devtools/                     # Separate devtools directory
│   ├── ServiceGraphRegistry.ts   # Development-only
│   ├── MessageFlowTracker.ts     # Development-only
│   ├── GraphVisualizer.ts        # Development-only
│   ├── DebugControls.ts          # Development-only
│   └── noop.ts                   # Production replacements
└── types/
    └── devtools.ts               # Type definitions only
```

#### No-op Implementations
```typescript
// src/devtools/noop.ts
export class ServiceGraphRegistry {
  registerService(): void {}
  trackMessage(): void {}
  dispose(): void {}
}

export class MessageFlowTracker {
  trackOutgoingMessage(): void {}
  trackIncomingMessage(): void {}
  dispose(): void {}
}
```

### Package.json Scripts
```json
{
  "scripts": {
    "build": "NODE_ENV=production vite build",
    "build:dev": "NODE_ENV=development vite build",
    "dev": "NODE_ENV=development STEWARD_DEVTOOLS=true vite dev"
  }
}
```

### TypeScript Configuration
```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@steward/devtools/*": ["./src/devtools/*"]
    }
  }
}

// tsconfig.prod.json (for production builds)
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "paths": {
      "@steward/devtools/*": ["./src/devtools/noop.ts"]
    }
  }
}
```

### Runtime Detection Pattern
```typescript
// Utility for runtime devtools detection
export const isDevtoolsEnabled = (): boolean => {
  return process.env.NODE_ENV === 'development' &&
         process.env.STEWARD_DEVTOOLS !== 'false' &&
         typeof window !== 'undefined'
}

// Usage throughout codebase
if (isDevtoolsEnabled()) {
  // Only execute devtools code in development
}
```

### Bundle Analysis Verification
```bash
# Analyze production bundle to verify devtools exclusion
npm run build
npx vite-bundle-analyzer dist

# Or with webpack-bundle-analyzer
npx webpack-bundle-analyzer dist/steward.js
```

This approach ensures zero production overhead while maintaining full development capabilities through dynamic imports, environment gating, and build-time exclusion strategies.

This visualization system transforms the abstract concept of message-driven services into a tangible, interactive experience that aids both development and production debugging while providing an impressive demonstration of the Steward architecture's capabilities.