import { createSignal, createEffect, onCleanup } from 'solid-js'
import { createServiceState, createServiceActions } from '@d-buckner/steward-solid'
import { DataProcessingToken } from '../services'

export function DataProcessingDemo() {
  const [itemCount, setItemCount] = createSignal(100000) // Start with 100K for better UX
  const [operation, setOperation] = createSignal<'sum' | 'fibonacci' | 'prime_count'>('sum')

  // Service state - automatically synced from worker!
  const state = createServiceState(DataProcessingToken)

  // Get service actions - works with both regular services and worker services
  const actions = createServiceActions(DataProcessingToken)
  console.log('[DataProcessingDemo] Actions created:', actions)
  console.log('[DataProcessingDemo] startProcessing method:', actions.startProcessing)
  console.log('[DataProcessingDemo] Actions object keys:', Object.keys(actions))
  console.log('[DataProcessingDemo] Actions proxy target:', actions)

  // Test if the proxy works for ownKeys
  console.log('[DataProcessingDemo] Actions ownKeys:', Object.getOwnPropertyNames(actions))
  console.log('[DataProcessingDemo] Actions has startProcessing:', 'startProcessing' in actions)
  console.log('[DataProcessingDemo] Actions startProcessing descriptor:', Object.getOwnPropertyDescriptor(actions, 'startProcessing'))

  // Expose validation function globally for manual testing
  ;(window as any).__validateDataProcessing = async () => {
    console.log('🧪 [VALIDATION] Starting DataProcessing validation...')
    console.log('🔧 [VALIDATION] Actions object:', actions)
    console.log('🔧 [VALIDATION] Available action methods:', Object.getOwnPropertyNames(actions))
    console.log('🔧 [VALIDATION] startProcessing type:', typeof actions.startProcessing)

    try {
      console.log('🚀 [VALIDATION] Testing startProcessing...')
      const testItems = [1, 2, 3, 4, 5]
      const expectedResult = 15 // 1+2+3+4+5 = 15

      const result = await actions.startProcessing(testItems, 'sum')
      console.log('✅ [VALIDATION] startProcessing completed with result:', result)
      console.log('🎯 [VALIDATION] Expected result:', expectedResult)

      const success = result === expectedResult
      console.log(success ? '🎉 [VALIDATION] SUCCESS - Action routing is working!' : '❌ [VALIDATION] FAILED - Result mismatch')

      return { success, result, expected: expectedResult, actions: Object.getOwnPropertyNames(actions) }
    } catch (error) {
      console.error('❌ [VALIDATION] FAILED with error:', error)
      return { success: false, error: error.message, actions: Object.getOwnPropertyNames(actions) }
    }
  }

  // Auto-trigger validation in development after a delay
  if (process.env.NODE_ENV === 'development') {
    setTimeout(() => {
      console.log('🔄 [VALIDATION] Auto-triggering validation test...')
      ;(window as any).__validateDataProcessing?.()
    }, 3000)
  }

  const handleStartProcessing = async () => {
    console.log('[DataProcessingDemo] Starting processing...')
    console.log('[DataProcessingDemo] Actions object:', actions)
    console.log('[DataProcessingDemo] startProcessing method type:', typeof actions.startProcessing)
    console.log('[DataProcessingDemo] startProcessing method:', actions.startProcessing)

    const items = Array.from({ length: itemCount() }, (_, i) => Math.floor(Math.random() * 100) + 1)
    console.log('[DataProcessingDemo] Calling startProcessing with', items.length, 'items and operation:', operation())

    try {
      console.log('[DataProcessingDemo] About to call actions.startProcessing...')
      const result = await actions.startProcessing(items, operation())
      console.log('[DataProcessingDemo] startProcessing completed with result:', result)
    } catch (error) {
      console.error('[DataProcessingDemo] startProcessing failed with error:', error)
      console.error('[DataProcessingDemo] Error stack:', error.stack)
    }
  }

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '—'
    return num.toLocaleString()
  }

  const getOperationDescription = () => {
    switch (operation()) {
      case 'sum': return 'Sum all numbers (lightweight)'
      case 'fibonacci': return 'Calculate fibonacci for each number (mod 35) - moderate CPU'
      case 'prime_count': return 'Count primes up to each number (mod 2000) - heavy CPU'
    }
  }

  const getEstimatedTime = () => {
    const count = itemCount()
    const op = operation()
    
    if (count < 50000) return 'seconds'
    if (count < 500000) {
      return op === 'sum' ? 'seconds' : op === 'fibonacci' ? '10-30 seconds' : '30-60 seconds'
    }
    if (count < 2000000) {
      return op === 'sum' ? 'seconds' : op === 'fibonacci' ? '1-2 minutes' : '2-5 minutes'  
    }
    if (count < 5000000) {
      return op === 'sum' ? '1-2 seconds' : op === 'fibonacci' ? '2-5 minutes' : '5-10 minutes'
    }
    // 10M items
    return op === 'sum' ? '2-3 seconds' : op === 'fibonacci' ? '5-10 minutes' : '10-20 minutes 🚀'
  }

  return (
    <div class="demo-section">
      <div class="demo-header">
        <h2>🔧 Worker Data Processing</h2>
        <p>CPU-intensive processing automatically runs in a Web Worker</p>
      </div>

      <div class="demo-controls">
        <div class="control-group">
          <label>
            Items to process:
            <input
              type="range"
              min="1000"
              max="10000000"
              step="10000"
              value={itemCount()}
              onInput={(e) => setItemCount(parseInt(e.currentTarget.value))}
              disabled={state.isProcessing}
            />
            <span class="control-value">{itemCount().toLocaleString()}</span>
          </label>
        </div>
        
        <div class="control-group">
          <label>
            Quick presets:
            <div class="preset-buttons">
              <button 
                class="btn btn-sm"
                onClick={() => setItemCount(10000)}
                disabled={state.isProcessing}
              >
                10K
              </button>
              <button 
                class="btn btn-sm"
                onClick={() => setItemCount(100000)}
                disabled={state.isProcessing}
              >
                100K
              </button>
              <button 
                class="btn btn-sm"
                onClick={() => setItemCount(1000000)}
                disabled={state.isProcessing}
              >
                1M
              </button>
              <button 
                class="btn btn-sm"
                onClick={() => setItemCount(5000000)}
                disabled={state.isProcessing}
              >
                5M
              </button>
              <button 
                class="btn btn-sm extreme"
                onClick={() => setItemCount(10000000)}
                disabled={state.isProcessing}
              >
                10M 🚀
              </button>
            </div>
          </label>
        </div>

        <div class="control-group">
          <label>
            Operation:
            <select
              value={operation()}
              onChange={(e) => setOperation(e.currentTarget.value as any)}
              disabled={state.isProcessing}
            >
              <option value="sum">Sum</option>
              <option value="fibonacci">Fibonacci</option>
              <option value="prime_count">Prime Count</option>
            </select>
          </label>
          <span class="operation-desc">
            {getOperationDescription()}
            <br />
            <small style="color: #666;">Estimated time: {getEstimatedTime()}</small>
          </span>
        </div>

        <div class="demo-actions">
          <button
            onClick={handleStartProcessing}
            disabled={state.isProcessing}
            class="btn btn-primary"
          >
            {state.isProcessing ? 'Processing...' : 'Start Processing'}
          </button>
          
          <button
            onClick={() => actions.cancelProcessing()}
            disabled={!state.isProcessing}
            class="btn btn-secondary"
          >
            Cancel
          </button>
          
          <button
            onClick={() => actions.reset()}
            disabled={state.isProcessing}
            class="btn btn-outline"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Progress Display */}
      <div class="progress-section">
        <div class="progress-header">
          <span>Progress: {Math.round((state.progress || 0) * 100)}%</span>
          <span>
            {(state.processedItems || 0).toLocaleString()} / {(state.totalItems || 0).toLocaleString()} items
          </span>
        </div>
        
        <div class="progress-bar">
          <div 
            class="progress-fill"
            style={{ width: `${(state.progress || 0) * 100}%` }}
          />
        </div>

        {state.result !== null && (
          <div class="result-display">
            <strong>Result: {formatNumber(state.result)}</strong>
          </div>
        )}
      </div>

      {/* Worker Info */}
      <div class="info-panel">
        <h3>🎯 Worker Benefits</h3>
        <ul>
          <li><strong>Non-blocking:</strong> UI stays responsive during heavy computation</li>
          <li><strong>Transparent:</strong> Same API as regular services - just add <code>@withWorker()</code></li>
          <li><strong>Type-safe:</strong> Full TypeScript support across worker boundary</li>
          <li><strong>Auto-sync:</strong> State changes automatically sync from worker to UI</li>
          <li><strong>Scalable:</strong> Handles millions of items without freezing the browser</li>
        </ul>
        
        <div class="code-example">
          <h4>💡 Ultimate Challenge:</h4>
          <p>1. Click "10M 🚀" preset<br/>
             2. Select "Prime Count" for maximum CPU load<br/>
             3. Click "Start Processing" and watch the UI stay perfectly responsive<br/>
             4. Try scrolling, clicking tabs, even running other demos - everything works!</p>
        </div>
        
        <div class="code-example">
          <h4>Service Definition:</h4>
          <pre><code>{`@withWorker('DataProcessor')
class DataProcessingService extends Service {
  // Heavy computation runs in worker!
  startProcessing(items: number[], operation: string) {
    // CPU-intensive work here
  }
}`}</code></pre>
        </div>
      </div>
    </div>
  )
}