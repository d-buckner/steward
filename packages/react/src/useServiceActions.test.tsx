import { Service, ServiceContainer, createServiceToken } from '@d-buckner/steward';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceProvider } from './ServiceProvider';
import { useServiceActions } from './useServiceActions';
import type { ReactNode } from 'react';


interface TodoState {
  items: string[]
  filter: 'all' | 'completed' | 'active'
  loading: boolean
}

class TodoService extends Service<TodoState> {
  constructor() {
    super({
      items: [],
      filter: 'all',
      loading: false
    });
  }

  addItem(text: string): void {
    const current = this.state.items || [];
    this.setState('items', [...current, text]);
  }

  removeItem(index: number): void {
    const current = this.state.items || [];
    this.setState('items', current.filter((_: string, i: number) => i !== index));
  }

  setFilter(filter: 'all' | 'completed' | 'active'): void {
    this.setState('filter', filter);
  }

  clearAll(): void {
    this.setState('items', []);
  }

  async loadItems(): Promise<void> {
    this.setState('loading', true);
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 10));
    this.setState('items', ['Loaded item 1', 'Loaded item 2']);
    this.setState('loading', false);
  }
}

// Create typed service token
const TodoToken = createServiceToken<TodoService>('Todo');

// Augment the ServiceToken type for intellisense
declare module '@d-buckner/steward' {
  interface ServiceTokenRegistry {
    Todo: typeof TodoToken;
  }
}

describe('useServiceActions', () => {
  let container: ServiceContainer;
  let service: TodoService;

  beforeEach(() => {
    container = new ServiceContainer();
    container.register(TodoToken, TodoService);
    service = container.resolve(TodoToken);
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <ServiceProvider container={container}>{children}</ServiceProvider>
  );

  it('should return all service methods as actions', () => {
    const { result } = renderHook(() => useServiceActions(TodoToken), { wrapper });

    // Test that the proxy provides the expected methods as functions
    expect(typeof result.current.addItem).toBe('function');
    expect(typeof result.current.removeItem).toBe('function');
    expect(typeof result.current.setFilter).toBe('function');
    expect(typeof result.current.clearAll).toBe('function');
    expect(typeof result.current.loadItems).toBe('function');
  });

  it('should call service methods through actions', async () => {
    const { result } = renderHook(() => useServiceActions(TodoToken), { wrapper });
    
    expect(service.state.items).toEqual([]);
    
    await act(async () => {
      await result.current.addItem('Test item');
    });
    
    expect(service.state.items).toEqual(['Test item']);
  });

  it('should handle multiple action calls', async () => {
    const { result } = renderHook(() => useServiceActions(TodoToken), { wrapper });
    
    await act(async () => {
      await result.current.addItem('Item 1');
      await result.current.addItem('Item 2');
      await result.current.addItem('Item 3');
    });
    
    expect(service.state.items).toEqual(['Item 1', 'Item 2', 'Item 3']);
    
    await act(async () => {
      await result.current.removeItem(1);
    });
    
    expect(service.state.items).toEqual(['Item 1', 'Item 3']);
  });

  it('should handle actions with different parameter types', async () => {
    const { result } = renderHook(() => useServiceActions(TodoToken), { wrapper });
    
    await act(async () => {
      await result.current.setFilter('completed');
    });
    
    expect(service.state.filter).toBe('completed');
  });

  it('should handle async actions', async () => {
    const { result } = renderHook(() => useServiceActions(TodoToken), { wrapper });

    expect(service.state.loading).toBe(false);
    expect(service.state.items).toEqual([]);

    await act(async () => {
      result.current.loadItems();
      // Wait a bit longer since async method runs in background
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(service.state.loading).toBe(false);
    expect(service.state.items).toEqual(['Loaded item 1', 'Loaded item 2']);
  });

  it('should not include private methods or properties', () => {
    const { result } = renderHook(() => useServiceActions(TodoToken), { wrapper });

    // Should not include inherited methods from Service base class
    // These should be undefined since the proxy only provides action methods
    expect((result.current as any).send).toBeUndefined();
    expect((result.current as any).request).toBeUndefined();
    expect((result.current as any).on).toBeUndefined();
    expect((result.current as any).getState).toBeUndefined();
    expect((result.current as any).clear).toBeUndefined();
  });

  it('should return stable references across re-renders', () => {
    const { result, rerender } = renderHook(() => useServiceActions(TodoToken), { wrapper });
    
    const firstActions = result.current;
    
    rerender();
    
    const secondActions = result.current;
    
    expect(firstActions).toBe(secondActions);
  });
});
