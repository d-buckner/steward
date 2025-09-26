import { promises as fs } from 'node:fs';
import { glob } from 'glob';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stewardWorkerPlugin } from '../src/vite-plugin';

// Mock fs operations
vi.mock('node:fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn()
  }
}));
vi.mock('glob');



describe('stewardWorkerPlugin', () => {
  const mockConfig = {
    command: 'serve' as const,
    root: '/test/project'
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue('');
    vi.mocked(glob).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('plugin configuration', () => {
    it('should create plugin with default options', () => {
      const plugin = stewardWorkerPlugin();

      expect(plugin.name).toBe('steward-worker-plugin');
      expect(typeof plugin.configResolved).toBe('function');
      expect(typeof plugin.buildStart).toBe('function');
    });

    it('should use custom options when provided', () => {
      const options = {
        include: 'custom/**/*.ts',
        registryOutDir: 'customGenerated',
        debug: true
      };

      const plugin = stewardWorkerPlugin(options);
      expect(plugin.name).toBe('steward-worker-plugin');
    });
  });

  describe('service discovery', () => {
    it('should discover services with @withWorker decorator', async () => {
      const serviceFileContent = `
        import { Service, withWorker } from '@d-buckner/steward'

        @withWorker('DataProcessor')
        export class DataProcessingService extends Service {
          // service implementation
        }
      `;

      vi.mocked(glob).mockResolvedValue(['/test/project/src/services/DataProcessingService.ts']);
      vi.mocked(fs.readFile).mockResolvedValue(serviceFileContent);

      const plugin = stewardWorkerPlugin({ debug: true })
      ;(plugin.configResolved as Function)(mockConfig as any);

      await (plugin.buildStart as Function).call({} as any);

      // Should have discovered the service
      expect(vi.mocked(glob)).toHaveBeenCalledWith('src/**/*.{ts,tsx}', {
        cwd: '/test/project',
        absolute: true
      });
      expect(fs.readFile).toHaveBeenCalledWith('/test/project/src/services/DataProcessingService.ts', 'utf-8');
    });

    it('should handle files with no @withWorker decorators', async () => {
      const regularFileContent = `
        import { Service } from '@d-buckner/steward'

        export class RegularService extends Service {
          // regular service
        }
      `;

      vi.mocked(glob).mockResolvedValue(['/test/project/src/services/RegularService.ts']);
      vi.mocked(fs.readFile).mockResolvedValue(regularFileContent);

      const plugin = stewardWorkerPlugin()
      ;(plugin.configResolved as Function)(mockConfig as any);

      await (plugin.buildStart as Function).call({} as any);

      expect(fs.readFile).toHaveBeenCalled();
      // Should not generate any worker files since no @withWorker decorators found
    });

  });




  describe('error handling', () => {
    it('should handle file read errors gracefully', async () => {
      vi.mocked(glob).mockResolvedValue(['/test/project/src/services/ErrorService.ts']);
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      const plugin = stewardWorkerPlugin()
      ;(plugin.configResolved as Function)(mockConfig as any);

      // Should not throw, just continue with empty service list
      await expect((plugin.buildStart as Function).call({} as any)).resolves.toBeUndefined();
    });

  });

  describe('debugging output', () => {
    it('should log debug messages when debug is enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const plugin = stewardWorkerPlugin({ debug: true })
      ;(plugin.configResolved as Function)(mockConfig as any);

      await (plugin.buildStart as Function).call({} as any);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[steward-worker-plugin]')
      );

      consoleSpy.mockRestore();
    });

    it('should not log debug messages when debug is disabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const plugin = stewardWorkerPlugin({ debug: false })
      ;(plugin.configResolved as Function)(mockConfig as any);

      await (plugin.buildStart as Function).call({} as any);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
