# SolidJS-Steward Performance Guide

This document outlines the performance characteristics of the SolidJS integration with Steward and potential optimization strategies for high-performance applications.

## Current Architecture

### `createServiceState` Implementation
```typescript
function createServiceState<T, K>(serviceToken: T, key: K) {
  const service = container.resolve(serviceToken)
  const [value, setValue] = createSignal(service.state[key])
  
  const subscription = service.on(key, (newValue) => {
    setValue(() => newValue)  // Direct signal update
  })
  
  return value
}
```

### `createServiceActions` Implementation
```typescript
function createServiceActions<T>(serviceToken: T) {
  const service = container.resolve(serviceToken)
  // Dynamically creates action methods from @withMessages metadata
  // Each action call results in immediate service.send() -> setState() -> signal update
}
```

### Current Event Flow
1. **Action Called** → `service.send(messageType, payload)`
2. **Message Handled** → `service.handle()` calls `this.setState(key, value)`
3. **State Updated** → `service.setState()` calls `eventBus.emit(key, value)`
4. **Event Emitted** → Synchronously calls all subscribers
5. **Signal Updated** → `setValue()` triggers SolidJS reactivity
6. **UI Re-render** → SolidJS updates DOM

## Performance Characteristics

### Strengths
- **Fine-grained Reactivity**: SolidJS only updates components that depend on changed state
- **Lightweight Events**: Steward's event system has minimal overhead
- **Predictable Updates**: Synchronous event emission provides consistent behavior
- **Type Safety**: Full TypeScript support with no runtime overhead

### Current Behavior
- **Immediate Updates**: Each `setState()` call triggers immediate UI update
- **Multiple Re-renders**: Actions updating multiple state properties cause multiple renders
- **No Debouncing**: High-frequency updates (typing, counters) render on every change
- **Direct Mapping**: One service state change = one SolidJS signal update

## Optimization Strategies

### 1. Batched State Updates

**Problem**: Multiple state updates in a single action cause multiple re-renders.

```typescript
// Current: 3 separate re-renders
async loadSampleData() {
  this.setState('loading', true)     // Re-render 1
  this.setState('items', [])         // Re-render 2  
  this.setState('loading', false)    // Re-render 3
}
```

**Solution**: Batch updates within microtask boundary.

```typescript
// Future enhancement for Service base class
protected batchUpdates(updateFn: () => void): void {
  const updates: Array<{ key: string, value: any }> = []
  
  // Temporarily queue setState calls
  const originalSetState = this.setState.bind(this)
  this.setState = (key, value) => updates.push({ key, value })
  
  try {
    updateFn()
  } finally {
    this.setState = originalSetState
    
    // Flush all updates in next microtask
    queueMicrotask(() => {
      updates.forEach(({ key, value }) => originalSetState(key, value))
    })
  }
}

// Usage
async loadSampleData() {
  this.batchUpdates(() => {
    this.setState('loading', true)
    this.setState('items', sampleData)
    this.setState('loading', false)
  })
  // Results in single re-render
}
```

### 2. RAF Debouncing for High-Frequency Updates

**Problem**: Rapid updates (typing indicators, counters) cause excessive renders.

```typescript
// Current: Every keystroke triggers re-render
onInput={(e) => actions.setSearch(e.target.value)}
```

**Solution**: Optional RAF debouncing in `createServiceState`.

```typescript
// Future enhancement
function createServiceState<T, K>(
  serviceToken: T, 
  key: K, 
  options?: { debounce?: boolean | number }
) {
  const [value, setValue] = createSignal(initialValue)
  let rafId: number | null = null
  
  const subscription = service.on(key, (newValue) => {
    if (options?.debounce) {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        setValue(() => newValue)
        rafId = null
      })
    } else {
      setValue(() => newValue)
    }
  })
  
  return value
}

// Usage for high-frequency updates
const searchQuery = createServiceState(TodoToken, 'searchQuery', { debounce: true })
const isTyping = createServiceState(ChatToken, 'isTyping', { debounce: 16 }) // ~60fps
```

### 3. Automatic Action Batching

**Problem**: Complex actions need manual batching consideration.

**Solution**: Automatic batching for `@withMessages` actions.

```typescript
// Future @withMessages enhancement
@withMessages<TodoMessages>([...], { 
  autoBatch: true  // Automatically wrap all actions in batchUpdates
})
export class TodoService extends MessageService<TodoState, TodoMessages> {
  // All action handlers automatically batched
}
```

### 4. Selective Re-rendering with Memoization

**Problem**: Expensive derived computations run on every state change.

```typescript
// Current: Recalculates on every state change
const filteredItems = createMemo(() => {
  const items = createServiceState(TodoToken, 'items')()
  const filter = createServiceState(TodoToken, 'filter')()
  const searchQuery = createServiceState(TodoToken, 'searchQuery')()
  
  return expensiveFilterOperation(items, filter, searchQuery)
})
```

**Solution**: Service-level computed properties with smart invalidation.

```typescript
// Future enhancement: Service computed properties
class TodoService extends MessageService<TodoState, TodoMessages> {
  @computed(['items', 'filter', 'searchQuery'])
  get filteredItems() {
    return expensiveFilterOperation(
      this.state.items, 
      this.state.filter, 
      this.state.searchQuery
    )
  }
}

// Usage
const filteredItems = createServiceState(TodoToken, 'filteredItems') // Cached result
```

## Performance Monitoring

### Development Tools

```typescript
// Future performance monitoring
const perfConfig = {
  enabled: process.env.NODE_ENV === 'development',
  trackRerenders: true,
  logSlowUpdates: true,
  maxUpdateFrequency: 60, // fps
  warnThreshold: 16, // ms
}

// Usage
function createServiceState<T, K>(serviceToken: T, key: K) {
  if (perfConfig.enabled) {
    // Track subscription count, update frequency, render timing
  }
}
```

### Metrics to Track

- **Re-render Frequency**: Updates per second per component
- **Update Latency**: Time from setState to DOM update
- **Memory Usage**: Event listener and signal count
- **Bundle Size**: Impact of integration code

### Benchmarking

```typescript
// Performance test example
describe('SolidJS Performance', () => {
  it('handles high-frequency updates efficiently', async () => {
    const startTime = performance.now()
    
    // Simulate 1000 rapid state updates
    for (let i = 0; i < 1000; i++) {
      actions.updateCounter(i)
    }
    
    await new Promise(resolve => requestAnimationFrame(resolve))
    const endTime = performance.now()
    
    expect(endTime - startTime).toBeLessThan(100) // < 100ms total
  })
})
```

## When to Optimize

### Indicators You Need Optimization

1. **Measured Performance Issues**
   - Frame drops during interactions
   - Slow response to user input
   - High CPU usage in dev tools

2. **High-Frequency Updates**
   - Real-time data (WebSocket streams)
   - Animation-driven state changes
   - Typing indicators, search-as-you-type

3. **Complex State Dependencies**
   - Many components subscribing to same service
   - Expensive computed properties
   - Large lists with filtering/sorting

4. **Mobile Performance**
   - Slower devices showing lag
   - Battery usage concerns
   - Memory constraints

### Don't Optimize Unless

- **No Measured Problems**: SolidJS + Steward performs well for most use cases
- **Premature Optimization**: Profile first, optimize second
- **Simple Applications**: Basic CRUD apps rarely need optimization
- **Small Data Sets**: < 1000 items in lists typically perform fine

## Implementation Guidelines

### Progressive Enhancement

1. **Start Simple**: Use basic `useServiceState` and `useServiceActions`
2. **Measure Performance**: Use browser dev tools to identify bottlenecks
3. **Add Targeted Optimizations**: Apply specific solutions to problem areas
4. **Validate Improvements**: Measure before/after performance

### Best Practices

- **Batch Related Updates**: Group logical state changes together
- **Debounce High-Frequency Events**: User input, real-time data
- **Memoize Expensive Computations**: Complex filtering, sorting, calculations
- **Monitor in Development**: Catch performance issues early

### Migration Strategy

```typescript
// Phase 1: Current implementation (no changes needed)
const count = createServiceState(CounterToken, 'count')
const actions = createServiceActions(CounterToken)

// Phase 2: Add targeted optimizations
const searchQuery = createServiceState(TodoToken, 'searchQuery', { debounce: true })

// Phase 3: Service-level enhancements
this.batchUpdates(() => {
  this.setState('loading', true)
  this.setState('items', newItems)
  this.setState('loading', false)
})
```

## Conclusion

The current SolidJS-Steward integration provides excellent performance for typical applications. The outlined optimization strategies offer paths for scaling to high-performance, real-time applications while maintaining the simplicity and type safety of the current API.

Focus on measuring actual performance issues before implementing optimizations, and apply enhancements progressively based on specific use case requirements.