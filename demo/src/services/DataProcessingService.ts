import { Service, withWorker, createServiceToken, ServiceState } from '@d-buckner/steward'

interface DataProcessingState extends ServiceState {
  isProcessing: boolean
  progress: number
  result: number | null
  processedItems: number
  totalItems: number
  lastProcessedAt: number
}

// Shared initial state - accessible to both worker and client
export const INITIAL_DATA_PROCESSING_STATE: DataProcessingState = {
  isProcessing: false,
  progress: 0,
  result: null,
  processedItems: 0,
  totalItems: 0,
  lastProcessedAt: 0
}

/**
 * CPU-intensive data processing service that runs in a Web Worker
 * Demonstrates seamless worker integration with Steward services
 */
@withWorker('DataProcessor')
export class DataProcessingService extends Service<DataProcessingState> {
  private shouldCancel = false

  static getInitialState(): DataProcessingState {
    return INITIAL_DATA_PROCESSING_STATE
  }

  constructor() {
    super(INITIAL_DATA_PROCESSING_STATE)

  }

  async startProcessing(items: number[], operation: 'sum' | 'fibonacci' | 'prime_count'): Promise<void> {
    if (this.state.isProcessing) {
      return // Already processing
    }

    this.shouldCancel = false
    this.setStates({
      isProcessing: true,
      progress: 0,
      result: null,
      processedItems: 0,
      totalItems: items.length,
      lastProcessedAt: Date.now()
    })

    let result = 0
    // Optimize batch size based on item count and operation complexity
    let progressUpdates = 100
    if (items.length > 1000000) progressUpdates = 200 // More updates for large datasets
    if (items.length > 10000000) progressUpdates = 500 // Even more for very large datasets
    if (items.length > 100000000) progressUpdates = 1000 // Maximum updates for extreme datasets

    // Adjust for operation complexity
    if (operation === 'prime_count' && items.length > 500000) {
      progressUpdates = Math.min(progressUpdates * 2, 1000)
    }

    const batchSize = Math.max(1, Math.floor(items.length / progressUpdates))

    try {
      for (let i = 0; i < items.length; i++) {
        if (this.shouldCancel) {
          return
        }

        const item = items[i]

        // Perform the requested operation (CPU intensive)
        switch (operation) {
          case 'sum':
            result += item
            break
          case 'fibonacci':
            result += this.fibonacci(item % 35) // Moderate computation
            break
          case 'prime_count':
            result += this.countPrimesUpTo(item % 2000) // Heavy computation
            break
        }

        // Update progress periodically
        if (i % batchSize === 0 || i === items.length - 1) {
          const progress = (i + 1) / items.length
          this.setStates({
            progress,
            processedItems: i + 1,
            lastProcessedAt: Date.now()
          })

          // Yield more frequently for extreme workloads to prevent blocking
          const yieldTime = items.length > 50000000 ? 2 : items.length > 10000000 ? 1 : 1
          await this.sleep(yieldTime)
        }
      }

      // Processing complete
      this.setStates({
        isProcessing: false,
        result,
        progress: 1
      })

    } catch (error) {
      console.error('Data processing error:', error)
      this.setStates({
        isProcessing: false,
        result: null
      })
    }
  }

  cancelProcessing() {
    this.shouldCancel = true
    this.setState('isProcessing', false)
  }

  reset() {
    this.shouldCancel = false
    this.setStates({
      isProcessing: false,
      progress: 0,
      result: null,
      processedItems: 0,
      totalItems: 0,
      lastProcessedAt: 0
    })
  }

  private fibonacci(n: number): number {
    if (n <= 1) return n
    let a = 0, b = 1
    for (let i = 2; i <= n; i++) {
      [a, b] = [b, a + b]
    }
    return b
  }

  private countPrimesUpTo(n: number): number {
    if (n < 2) return 0
    
    const sieve = new Array(n + 1).fill(true)
    sieve[0] = sieve[1] = false
    
    for (let i = 2; i * i <= n; i++) {
      if (sieve[i]) {
        for (let j = i * i; j <= n; j += i) {
          sieve[j] = false
        }
      }
    }
    
    return sieve.filter(Boolean).length
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Create service token
export const DataProcessingToken = createServiceToken<DataProcessingService>('dataProcessing')