import { createSignal, createEffect, onCleanup } from 'solid-js'
import { createServiceState, useServiceContainer } from '@d-buckner/steward-solid'
import { DataProcessingToken } from '../services'

export function DataProcessingDemo() {
  const [itemCount, setItemCount] = createSignal(100000) // Start with 100K for better UX
  const [operation, setOperation] = createSignal<'sum' | 'fibonacci' | 'prime_count'>('sum')
  
  // Service state - automatically synced from worker!
  const isProcessing = createServiceState(DataProcessingToken, 'isProcessing')
  const progress = createServiceState(DataProcessingToken, 'progress')
  const result = createServiceState(DataProcessingToken, 'result')
  const processedItems = createServiceState(DataProcessingToken, 'processedItems')
  const totalItems = createServiceState(DataProcessingToken, 'totalItems')
  
  // Get the service directly
  const container = useServiceContainer()
  const service = container.resolve(DataProcessingToken)

  const handleStartProcessing = async () => {
    const items = Array.from({ length: itemCount() }, (_, i) => Math.floor(Math.random() * 100) + 1)
    await service.startProcessing(items, operation())
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
              disabled={isProcessing()}
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
                disabled={isProcessing()}
              >
                10K
              </button>
              <button 
                class="btn btn-sm"
                onClick={() => setItemCount(100000)}
                disabled={isProcessing()}
              >
                100K
              </button>
              <button 
                class="btn btn-sm"
                onClick={() => setItemCount(1000000)}
                disabled={isProcessing()}
              >
                1M
              </button>
              <button 
                class="btn btn-sm"
                onClick={() => setItemCount(5000000)}
                disabled={isProcessing()}
              >
                5M
              </button>
              <button 
                class="btn btn-sm extreme"
                onClick={() => setItemCount(10000000)}
                disabled={isProcessing()}
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
              disabled={isProcessing()}
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
            disabled={isProcessing()}
            class="btn btn-primary"
          >
            {isProcessing() ? 'Processing...' : 'Start Processing'}
          </button>
          
          <button
            onClick={() => service.cancelProcessing()}
            disabled={!isProcessing()}
            class="btn btn-secondary"
          >
            Cancel
          </button>
          
          <button
            onClick={() => service.reset()}
            disabled={isProcessing()}
            class="btn btn-outline"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Progress Display */}
      <div class="progress-section">
        <div class="progress-header">
          <span>Progress: {Math.round((progress() || 0) * 100)}%</span>
          <span>
            {(processedItems() || 0).toLocaleString()} / {(totalItems() || 0).toLocaleString()} items
          </span>
        </div>
        
        <div class="progress-bar">
          <div 
            class="progress-fill"
            style={{ width: `${(progress() || 0) * 100}%` }}
          />
        </div>

        {result() !== null && (
          <div class="result-display">
            <strong>Result: {formatNumber(result())}</strong>
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
          <pre><code>{`@withWorker({ name: 'DataProcessor' })
@withMessages<DataProcessingMessages>([...])
class DataProcessingService extends Service {
  // Heavy computation runs in worker!
}`}</code></pre>
        </div>
      </div>
    </div>
  )
}