import { Service, ServiceState } from '@d-buckner/steward'

interface CounterState extends ServiceState {
  count: number
  step: number
  name: string
  isActive: boolean
  history: number[]
  error: 'STEP_OUT_OF_BOUNDS' | 'HISTORY_OVERFLOW' | null
}

export class CounterService extends Service<CounterState> {
  constructor() {
    super({
      count: 0,
      step: 1,
      name: 'counter',
      isActive: true,
      history: [0],
      error: null
    })
  }

  increment() {
    if (!this.state.isActive) return

    // Clear previous errors
    if (this.state.error) {
      this.setState('error', null)
    }

    // Check for potential overflow
    if (this.state.history.length >= 100) {
      this.setState('error', 'HISTORY_OVERFLOW')
      return
    }

    const newCount = this.state.count + this.state.step
    this.setState('count', newCount)
    this.setState('history', [...this.state.history, newCount])
  }

  decrement() {
    if (!this.state.isActive) return

    const newCount = this.state.count - this.state.step
    this.setState('count', newCount)
    this.setState('history', [...this.state.history, newCount])
  }

  setStep(step: number) {
    // Clear previous errors
    if (this.state.error) {
      this.setState('error', null)
    }

    // Validate step bounds
    if (step < 1 || step > 10) {
      this.setState('error', 'STEP_OUT_OF_BOUNDS')
      return
    }

    this.setState('step', step)
  }

  setName(name: string) {
    this.setState('name', name)
  }

  toggle() {
    this.setState('isActive', !this.state.isActive)
  }

  reset() {
    this.setState('count', 0)
    this.setState('history', [0])
    this.setState('error', null)
  }

  clearError() {
    this.setState('error', null)
  }

  undo() {
    if (this.state.history.length <= 1) return

    const newHistory = [...this.state.history]
    newHistory.pop() // Remove current
    const previousValue = newHistory[newHistory.length - 1]

    this.setState('count', previousValue)
    this.setState('history', newHistory)
  }

  // Query methods remain synchronous for computed properties
  getStats() {
    return {
      current: this.state.count,
      total: this.state.history.length,
      min: Math.min(...this.state.history),
      max: Math.max(...this.state.history),
      average: this.state.history.reduce((a, b) => a + b, 0) / this.state.history.length
    }
  }
}