import { Service } from '@d-buckner/steward'

interface CounterState {
  count: number
  step: number
  isActive: boolean
  history: number[]
}

export class CounterService extends Service<CounterState> {
  constructor() {
    super({
      count: 0,
      step: 1,
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

  // Demonstrate strongly typed state access
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