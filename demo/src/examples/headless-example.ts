/**
 * Example of using Steward services in headless/non-UI contexts
 * Demonstrates pure message-passing architecture with ServiceClient
 */

import { ServiceContainer, createServiceClient, ServiceStateObserver } from '@d-buckner/steward'
import { CounterService, TodoService, CounterToken, TodoToken } from '../services/index.js'

// Create service container
const container = new ServiceContainer()
container.register(CounterToken, CounterService)
container.register(TodoToken, TodoService)

// Example 1: Basic service interaction
async function basicExample() {
  console.log('=== Basic Headless Service Example ===')

  const counterClient = createServiceClient(container, CounterToken)

  // Get initial state using strongly typed proxy
  console.log('Initial count:', counterClient.state.count)

  // Call methods directly on the client actions
  await counterClient.actions.increment()
  await counterClient.actions.increment()
  await counterClient.actions.setStep(5)
  await counterClient.actions.increment()

  console.log('Final count:', counterClient.state.count)
  console.log('Step size:', counterClient.state.step)
  console.log('Is active:', counterClient.state.isActive)
  
  counterClient.dispose()
}

// Example 2: State observation and reactions
async function observationExample() {
  console.log('\n=== State Observation Example ===')
  
  const todoClient = createServiceClient(container, TodoToken)

  // Subscribe to specific state changes with full type safety
  const itemsSubscription = todoClient.subscribe('items', (items) => {
    console.log(`📝 Todo items changed: ${items.length} items`)
    // items is fully typed as Todo[] here
  })

  const filterSubscription = todoClient.subscribe('filter', (filter) => {
    console.log(`🔍 Filter changed to: ${filter}`)
    // filter is typed as 'all' | 'active' | 'completed'
  })

  // Perform actions
  await todoClient.actions.addItem('Learn Steward architecture', 'high')
  await todoClient.actions.addItem('Build message-driven services', 'medium')
  await todoClient.actions.setFilter('active')
  
  // Clean up
  itemsSubscription.unsubscribe()
  filterSubscription.unsubscribe()
  todoClient.dispose()
}

// Example 3: Waiting for conditions (useful for testing/automation)
async function conditionalWaitExample() {
  console.log('\n=== Conditional Wait Example ===')
  
  const observer = new ServiceStateObserver(container, CounterToken)
  const counterClient = createServiceClient(container, CounterToken)

  // Start async operation
  setTimeout(async () => {
    await counterClient.actions.reset()
    await counterClient.actions.increment()
    await counterClient.actions.increment()
    await counterClient.actions.increment()
  }, 100)
  
  try {
    // Wait for count to reach 3 (with 2 second timeout)
    const finalCount = await observer.waitFor('count', count => count === 3, 2000)
    console.log(`✅ Count reached target: ${finalCount}`)
  } catch (error) {
    console.log(`❌ Timeout waiting for condition: ${error.message}`)
  }
  
  counterClient.dispose()
}

// Example 4: Service orchestration (multiple services working together)
async function orchestrationExample() {
  console.log('\n=== Service Orchestration Example ===')
  
  const counterClient = createServiceClient(container, CounterToken)
  const todoClient = createServiceClient(container, TodoToken)

  // Coordinate multiple services
  await counterClient.actions.reset()
  await todoClient.actions.clearCompleted()

  // Add todos and increment counter for each
  const todos = ['Design architecture', 'Implement features', 'Write tests']

  for (const todo of todos) {
    await todoClient.actions.addItem(todo, 'medium')
    await counterClient.actions.increment()
  }
  
  console.log('Created todos:', todoClient.state.items.length)
  console.log('Counter value:', counterClient.state.count)
  
  // Both services now have synchronized state - use snapshots for full state
  const allStates = {
    counter: counterClient.snapshot(),
    todos: todoClient.snapshot()
  }
  
  console.log('Final coordinated state:', JSON.stringify(allStates, null, 2))
  
  counterClient.dispose()
  todoClient.dispose()
}

// Run all examples
export async function runHeadlessExamples() {
  try {
    await basicExample()
    await observationExample()
    await conditionalWaitExample()
    await orchestrationExample()
    
    console.log('\n🎉 All headless examples completed successfully!')
  } catch (error) {
    console.error('❌ Example failed:', error)
  }
}

// Auto-run in development
if (import.meta.env.DEV) {
  // Run examples after a short delay to let devtools load
  setTimeout(() => {
    console.log('🚀 Running headless service examples...')
    runHeadlessExamples()
  }, 1000)
}