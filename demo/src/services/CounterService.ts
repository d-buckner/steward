import { Service, withMessages, Message, ServiceState, ServiceMessages } from '@d-buckner/steward'

interface CounterState extends ServiceState {
  count: number
  step: number
  name: string
  isActive: boolean
  history: number[]
}

interface CounterMessages extends ServiceMessages {
  INCREMENT: {}
  DECREMENT: {}
  SET_STEP: { step: number }
  SET_NAME: { name: string }
  TOGGLE: {}
  RESET: {}
  UNDO: {}
}

@withMessages<CounterMessages>([
  'INCREMENT',
  'DECREMENT', 
  'SET_STEP',
  'SET_NAME',
  'TOGGLE',
  'RESET',
  'UNDO'
], {
  INCREMENT: () => ({}),
  DECREMENT: () => ({}),
  SET_STEP: (step: number) => ({ step }),
  SET_NAME: (name: string) => ({ name }),
  TOGGLE: () => ({}),
  RESET: () => ({}),
  UNDO: () => ({})
})
export class CounterService extends Service<CounterState, CounterMessages> {
  constructor() {
    super({
      count: 0,
      step: 1,
      name: 'counter',
      isActive: true,
      history: [0]
    })
  }

  async handle<K extends keyof CounterMessages>(
    message: Message<CounterMessages, K>
  ): Promise<void> {
    switch (message.type) {
      case 'INCREMENT': {
        if (!this.state.isActive) return
        
        const newCount = this.state.count + this.state.step
        this.setState('count', newCount)
        this.setState('history', [...this.state.history, newCount])
        break
      }

      case 'DECREMENT': {
        if (!this.state.isActive) return
        
        const newCount = this.state.count - this.state.step
        this.setState('count', newCount)
        this.setState('history', [...this.state.history, newCount])
        break
      }

      case 'SET_STEP': {
        const { step } = message.payload as CounterMessages['SET_STEP']
        this.setState('step', Math.max(1, Math.min(10, step)))
        break
      }

      case 'SET_NAME': {
        const { name } = message.payload as CounterMessages['SET_NAME']
        this.setState('name', name)
        break
      }

      case 'TOGGLE': {
        this.setState('isActive', !this.state.isActive)
        break
      }

      case 'RESET': {
        this.setState('count', 0)
        this.setState('history', [0])
        break
      }

      case 'UNDO': {
        if (this.state.history.length <= 1) return
        
        const newHistory = [...this.state.history]
        newHistory.pop() // Remove current
        const previousValue = newHistory[newHistory.length - 1]
        
        this.setState('count', previousValue)
        this.setState('history', newHistory)
        break
      }
    }
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