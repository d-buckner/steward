import { Service, ServiceContainer, createServiceToken } from '@d-buckner/steward';
import { render } from '@solidjs/testing-library';
import { describe, it, expect, beforeEach } from 'vitest';
import { createServiceActions } from './createServiceActions';
import { createServiceState } from './createServiceState';
import { ServiceProvider } from './ServiceProvider';


interface CounterState {
  count: number
  name: string
  isActive: boolean
}

class CounterService extends Service<CounterState> {
  constructor() {
    super({
      count: 0,
      name: 'counter',
      isActive: true
    });
  }

  increment() {
    this.setState('count', this.state.count + 1);
  }

  setName(name: string) {
    this.setState('name', name);
  }

  toggle() {
    this.setState('isActive', !this.state.isActive);
  }
}

// Create service token for testing
const CounterToken = createServiceToken<CounterService>('counter');

describe('createServiceState', () => {
  let container: ServiceContainer;

  beforeEach(() => {
    container = new ServiceContainer();
    container.register(CounterToken, CounterService);
  });

  it('should return current value for all state properties', () => {
    function TestComponent() {
      const state = createServiceState(CounterToken);
      return (
        <div>
          <div data-testid="count">{state.count}</div>
          <div data-testid="name">{state.name}</div>
          <div data-testid="active">{state.isActive ? 'true' : 'false'}</div>
        </div>
      );
    }

    const { getByTestId } = render(() =>
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    );
    expect(getByTestId('count')).toHaveTextContent('0');
    expect(getByTestId('name')).toHaveTextContent('counter');
    expect(getByTestId('active')).toHaveTextContent('true');
  });

  it('should update when service state changes', async () => {
    function TestComponent() {
      const state = createServiceState(CounterToken);
      const actions = createServiceActions(CounterToken);

      // Trigger action to test state update
      setTimeout(() => actions.increment(), 0);

      return <div data-testid="count">{state.count}</div>;
    }

    const { getByTestId } = render(() =>
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    );
    expect(getByTestId('count')).toHaveTextContent('0');

    // Wait for async action
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(getByTestId('count')).toHaveTextContent('1');
  });

  it('should work with string values', async () => {
    function TestComponent() {
      const state = createServiceState(CounterToken);
      const actions = createServiceActions(CounterToken);

      // Trigger action to test state update
      setTimeout(() => actions.setName('updated'), 0);

      return <div data-testid="name">{state.name}</div>;
    }

    const { getByTestId } = render(() =>
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    );
    expect(getByTestId('name')).toHaveTextContent('counter');

    // Wait for async action
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(getByTestId('name')).toHaveTextContent('updated');
  });

  it('should work with boolean values', async () => {
    function TestComponent() {
      const state = createServiceState(CounterToken);
      const actions = createServiceActions(CounterToken);

      // Trigger action to test state update
      setTimeout(() => actions.toggle(), 0);

      return <div data-testid="active">{state.isActive ? 'true' : 'false'}</div>;
    }

    const { getByTestId } = render(() =>
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    );
    expect(getByTestId('active')).toHaveTextContent('true');

    // Wait for async action
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(getByTestId('active')).toHaveTextContent('false');
  });

  it('should handle rapid state changes', async () => {
    function TestComponent() {
      const state = createServiceState(CounterToken);
      const actions = createServiceActions(CounterToken);

      // Trigger multiple actions
      setTimeout(async () => {
        await actions.increment();
        await actions.increment();
        await actions.increment();
      }, 0);

      return <div data-testid="count">{state.count}</div>;
    }

    const { getByTestId } = render(() =>
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    );
    expect(getByTestId('count')).toHaveTextContent('0');

    // Wait for async actions
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(getByTestId('count')).toHaveTextContent('3');
  });

  it('should maintain stable references across re-renders', () => {
    let renderCount = 0;
    function TestComponent() {
      renderCount++;
      const state = createServiceState(CounterToken);

      return (
        <div>
          <div data-testid="count">{state.count}</div>
          <div data-testid="renders">{renderCount}</div>
        </div>
      );
    }

    const { getByTestId } = render(() =>
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    );

    expect(getByTestId('count')).toHaveTextContent('0');
    expect(getByTestId('renders')).toHaveTextContent('1');
  });

  it('should support destructuring assignment', () => {
    function TestComponent() {
      const { count, name, isActive } = createServiceState(CounterToken);

      return (
        <div>
          <div data-testid="count">{count}</div>
          <div data-testid="name">{name}</div>
          <div data-testid="active">{isActive ? 'true' : 'false'}</div>
        </div>
      );
    }

    const { getByTestId } = render(() =>
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    );

    expect(getByTestId('count')).toHaveTextContent('0');
    expect(getByTestId('name')).toHaveTextContent('counter');
    expect(getByTestId('active')).toHaveTextContent('true');
  });

  it('should work with destructuring in reactive contexts', () => {
    function TestComponent() {
      // Test that destructuring works at call time (initial render)
      const { count, name, isActive } = createServiceState(CounterToken);

      return (
        <div>
          <div data-testid="count-destructured">{count}</div>
          <div data-testid="name-destructured">{name}</div>
          <div data-testid="active-destructured">{isActive ? 'true' : 'false'}</div>
        </div>
      );
    }

    const { getByTestId } = render(() =>
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    );

    expect(getByTestId('count-destructured')).toHaveTextContent('0');
    expect(getByTestId('name-destructured')).toHaveTextContent('counter');
    expect(getByTestId('active-destructured')).toHaveTextContent('true');
  });
});
