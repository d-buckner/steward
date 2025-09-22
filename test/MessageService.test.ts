import { describe, it, expect, beforeEach } from 'vitest';
import { Service } from '../src/index';


interface TodoState {
  items: string[]
  filter: 'all' | 'completed' | 'active'
  loading: boolean
  error?: string
}

// Message-driven Todo service
class TodoService extends Service<TodoState> {
  constructor() {
    super({
      items: [],
      filter: 'all',
      loading: false
    });
  }

  addItem(text: string) {
    const current = this.state.items || [];
    this.setState('items', [...current, text]);
  }

  removeItem(index: number) {
    const current = this.state.items || [];
    this.setState('items', current.filter((_, i) => i !== index));
  }

  setFilter(filter: 'all' | 'completed' | 'active') {
    this.setState('filter', filter);
  }

  toggleItem(index: number) {
    // For demo purposes, just mark as completed by adding " ✓"
    const current = this.state.items || [];
    const updated = [...current];
    updated[index] = updated[index].endsWith(' ✓')
      ? updated[index].replace(' ✓', '')
      : updated[index] + ' ✓';
    this.setState('items', updated);
  }

  loadItemsStart() {
    this.setState('loading', true);
    this.setState('error', undefined);

    // Simulate async loading
    setTimeout(() => {
      this.send('loadItemsSuccess', [['Loaded item 1', 'Loaded item 2']]);
    }, 10);
  }

  loadItemsSuccess(items: string[]) {
    this.setState('items', items);
    this.setState('loading', false);
  }

  loadItemsError(error: string) {
    this.setState('error', error);
    this.setState('loading', false);
  }
}

describe('Service', () => {
  let service: TodoService;

  beforeEach(() => {
    service = new TodoService();
  });

  it('should handle addItem messages', async () => {
    expect(service.state.items).toEqual([]);

    await service.send('addItem', ['Test item']);

    expect(service.state.items).toEqual(['Test item']);
  });

  it('should handle multiple message types', async () => {
    await service.send('addItem', ['Item 1']);
    await service.send('addItem', ['Item 2']);
    await service.send('setFilter', ['completed']);

    expect(service.state.items).toEqual(['Item 1', 'Item 2']);
    expect(service.state.filter).toBe('completed');
  });

  it('should handle removeItem messages', async () => {
    await service.send('addItem', ['Item 1']);
    await service.send('addItem', ['Item 2']);
    await service.send('addItem', ['Item 3']);

    await service.send('removeItem', [1]);

    expect(service.state.items).toEqual(['Item 1', 'Item 3']);
  });

  it('should handle toggleItem messages', async () => {
    await service.send('addItem', ['Item 1']);
    await service.send('toggleItem', [0]);

    expect(service.state.items).toEqual(['Item 1 ✓']);

    await service.send('toggleItem', [0]);
    expect(service.state.items).toEqual(['Item 1']);
  });

  it('should track message history', async () => {
    await service.send('addItem', ['Item 1']);
    await service.send('setFilter', ['completed']);

    const history = service.getMessageHistory();
    expect(history).toHaveLength(2);
    expect(history[0].type).toBe('addItem');
    expect(history[1].type).toBe('setFilter');
  });

  it('should support async operations with message sequences', async () => {
    expect(service.state.loading).toBe(false);

    await service.send('loadItemsStart', []);
    expect(service.state.loading).toBe(true);

    // Wait for async completion
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(service.state.loading).toBe(false);
    expect(service.state.items).toEqual(['Loaded item 1', 'Loaded item 2']);
  });


  it('should emit state change events for reactive updates', async () => {
    const itemsChanges: string[][] = [];

    service.on('items', (items) => {
      itemsChanges.push(items);
    });

    await service.send('addItem', ['Item 1']);
    await service.send('addItem', ['Item 2']);

    expect(itemsChanges).toEqual([
      ['Item 1'],   // After first add
      ['Item 1', 'Item 2']  // After second add
    ]);
  });

});
