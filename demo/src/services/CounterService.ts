import { Service, ServiceState } from '@d-buckner/steward'

interface CounterState extends ServiceState {
  count: number
  step: number
  name: string
  isActive: boolean
  history: number[]
}

export class CounterService extends Service<CounterState> {
  constructor() {
    super({
      count: 0,
      step: 1,
      name: 'counter',
      isActive: true,
      history: [0]
    })
  }

  increment() {
    if (!this.state.isActive) return

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
    this.setState('step', Math.max(1, Math.min(10, step)))
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