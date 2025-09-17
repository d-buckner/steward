import { createServiceState, createServiceActions } from '@d-buckner/steward-solid'
import { createMemo, For } from 'solid-js'
import { CounterToken } from '../services'

export function CounterDemo() {
  const count = createServiceState(CounterToken, 'count')
  const step = createServiceState(CounterToken, 'step')
  const isActive = createServiceState(CounterToken, 'isActive')
  const history = createServiceState(CounterToken, 'history')
  
  const actions = createServiceActions(CounterToken)
  
  // Computed values using SolidJS memos
  const canUndo = createMemo(() => (history()?.length || 0) > 1)
  const stats = createMemo(() => {
    const h = history() || []
    if (h.length === 0) return null
    
    return {
      total: h.length,
      min: Math.min(...h),
      max: Math.max(...h),
      average: Math.round(h.reduce((a, b) => a + b, 0) / h.length * 100) / 100
    }
  })

  return (
    <div class="demo-section">
      <h2>🔢 Counter Demo</h2>
      <p class="demo-description">
        Showcases strongly typed state proxy with <code>service.state.property</code> access,
        reactive SolidJS primitives, and fine-grained updates.
      </p>
      
      <div class="counter-display">
        <div class="count-value" classList={{ inactive: !isActive() }}>
          {count()}
        </div>
        
        <div class="counter-controls">
          <div class="button-group">
            <button 
              class="counter-btn decrement"
              onClick={actions.decrement}
              disabled={!isActive()}
            >
              -{step()}
            </button>
            
            <button 
              class="counter-btn increment"
              onClick={actions.increment}
              disabled={!isActive()}
            >
              +{step()}
            </button>
          </div>
          
          <div class="step-control">
            <label>Step:</label>
            <input
              type="range"
              min="1"
              max="10"
              value={step()}
              onInput={(e) => actions.setStep(parseInt(e.target.value))}
            />
            <span>{step()}</span>
          </div>
          
          <div class="toggle-group">
            <button
              class="toggle-btn"
              classList={{ active: isActive() }}
              onClick={actions.toggle}
            >
              {isActive() ? '🟢 Active' : '🔴 Paused'}
            </button>
            
            <button
              class="reset-btn"
              onClick={actions.reset}
            >
              🔄 Reset
            </button>
            
            <button
              class="undo-btn"
              onClick={actions.undo}
              disabled={!canUndo()}
            >
              ↶ Undo
            </button>
          </div>
        </div>
      </div>
      
      <div class="counter-stats">
        <h4>📊 Statistics</h4>
        {stats() ? (
          <div class="stats-grid">
            <div class="stat">
              <span class="stat-label">Total Steps:</span>
              <span class="stat-value">{stats()!.total}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Min Value:</span>
              <span class="stat-value">{stats()!.min}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Max Value:</span>
              <span class="stat-value">{stats()!.max}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Average:</span>
              <span class="stat-value">{stats()!.average}</span>
            </div>
          </div>
        ) : (
          <p>No data yet</p>
        )}
      </div>
      
      <div class="history-section">
        <h4>📈 History</h4>
        <div class="history-list">
          <For each={history()}>
            {(value, index) => (
              <span 
                class="history-item"
                classList={{ current: index() === (history()?.length || 0) - 1 }}
              >
                {value}
              </span>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}