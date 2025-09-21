import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import { stewardWorkerPluginImpl } from '../src/build/vite-plugin-impl'
import { glob } from 'glob'

// Mock fs operations
vi.mock('fs/promises')
vi.mock('glob')

// Mock path module
vi.mock('path', () => ({
  join: vi.fn((...segments) => segments.join('/')),
  relative: vi.fn((from, to) => to.replace(from + '/', '')),
  resolve: vi.fn((...segments) => '/' + segments.join('/'))
}))


describe('stewardWorkerPlugin', () => {
  const mockConfig = {
    command: 'serve' as const,
    root: '/test/project'
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    vi.mocked(fs.mkdir).mockResolvedValue(undefined)
    vi.mocked(fs.writeFile).mockResolvedValue(undefined)
    vi.mocked(fs.readFile).mockResolvedValue('')
    vi.mocked(glob).mockResolvedValue([])
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('plugin configuration', () => {
    it('should create plugin with default options', () => {
      const plugin = stewardWorkerPluginImpl()

      expect(plugin.name).toBe('steward-worker-plugin')
      expect(typeof plugin.configResolved).toBe('function')
      expect(typeof plugin.buildStart).toBe('function')
    })

    it('should use custom options when provided', () => {
      const options = {
        include: 'custom/**/*.ts',
        registryOutDir: 'customGenerated',
        debug: true
      }

      const plugin = stewardWorkerPluginImpl(options)
      expect(plugin.name).toBe('steward-worker-plugin')
    })
  })

  describe('service discovery', () => {
    it('should discover services with @withWorker decorator', async () => {
      const serviceFileContent = `
        import { Service, withWorker } from '@d-buckner/steward'

        @withWorker('DataProcessor')
        export class DataProcessingService extends Service {
          // service implementation
        }
      `

      vi.mocked(glob).mockResolvedValue(['/test/project/src/services/DataProcessingService.ts'])
      vi.mocked(fs.readFile).mockResolvedValue(serviceFileContent)

      const plugin = stewardWorkerPluginImpl({ debug: true })
      plugin.configResolved!(mockConfig as any)

      await plugin.buildStart!.call({} as any)

      // Should have discovered the service
      expect(vi.mocked(glob)).toHaveBeenCalledWith('src/**/*.{ts,tsx}', {
        cwd: '/test/project',
        absolute: true
      })
      expect(fs.readFile).toHaveBeenCalledWith('/test/project/src/services/DataProcessingService.ts', 'utf-8')
    })

    it('should handle files with no @withWorker decorators', async () => {
      const regularFileContent = `
        import { Service } from '@d-buckner/steward'

        export class RegularService extends Service {
          // regular service
        }
      `

      vi.mocked(glob).mockResolvedValue(['/test/project/src/services/RegularService.ts'])
      vi.mocked(fs.readFile).mockResolvedValue(regularFileContent)

      const plugin = stewardWorkerPluginImpl()
      plugin.configResolved!(mockConfig as any)

      await plugin.buildStart!.call({} as any)

      expect(fs.readFile).toHaveBeenCalled()
      // Should not generate any worker files since no @withWorker decorators found
    })

    it('should match decorator to correct class', async () => {
      const multipleClassContent = `
        import { Service, withWorker } from '@d-buckner/steward'

        export class FirstService extends Service {
          // regular service
        }

        @withWorker('DataProcessor')
        export class DataProcessingService extends Service {
          // worker service
        }

        export class ThirdService extends Service {
          // another regular service
        }
      `

      vi.mocked(glob).mockResolvedValue(['/test/project/src/services/MultipleServices.ts'])
      vi.mocked(fs.readFile).mockResolvedValue(multipleClassContent)

      const plugin = stewardWorkerPluginImpl({ debug: true })
      plugin.configResolved!(mockConfig as any)

      await plugin.buildStart!.call({} as any)

      // Should only generate worker for DataProcessingService, not the others
      expect(fs.writeFile).toHaveBeenCalled()
    })
  })

  describe('worker entry generation', () => {
    it('should generate worker entry files in correct directory', async () => {
      const serviceFileContent = `
        @withWorker('TestWorker')
        export class TestService extends Service {}
      `

      vi.mocked(glob).mockResolvedValue(['/test/project/src/services/TestService.ts'])
      vi.mocked(fs.readFile).mockResolvedValue(serviceFileContent)

      const plugin = stewardWorkerPluginImpl({ registryOutDir: 'customGenerated' })
      plugin.configResolved!(mockConfig as any)

      await plugin.buildStart!.call({} as any)

      // Should create directory with registryOutDir parameter
      expect(fs.mkdir).toHaveBeenCalledWith(
        '/test/project/src/customGenerated/workers',
        { recursive: true }
      )

      // Should write worker file
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/project/src/customGenerated/workers/testworker.worker.ts',
        expect.stringContaining('TestService')
      )
    })

    it('should generate worker entry content with correct imports', async () => {
      const serviceFileContent = `
        @withWorker('DataProcessor')
        export class DataProcessingService extends Service {}
      `

      vi.mocked(glob).mockResolvedValue(['/test/project/src/services/DataProcessingService.ts'])
      vi.mocked(fs.readFile).mockResolvedValue(serviceFileContent)

      const plugin = stewardWorkerPluginImpl()
      plugin.configResolved!(mockConfig as any)

      await plugin.buildStart!.call({} as any)

      const writeCall = vi.mocked(fs.writeFile).mock.calls.find(call =>
        call[0].toString().includes('dataprocessor.worker.ts')
      )

      expect(writeCall).toBeDefined()
      const workerContent = writeCall![1] as string

      // Should contain proper imports and registration
      expect(workerContent).toContain('import { DataProcessingService }')
      expect(workerContent).toContain('registerWorkerService(\'DataProcessingService\'')
      expect(workerContent).toContain('@d-buckner/steward/worker/worker-runtime')
    })
  })

  describe('registry generation', () => {
    it('should generate registry file with worker bundles', async () => {
      const serviceFileContent = `
        @withWorker('DataProcessor')
        export class DataProcessingService extends Service {}
      `

      vi.mocked(glob).mockResolvedValue(['/test/project/src/services/DataProcessingService.ts'])
      vi.mocked(fs.readFile).mockResolvedValue(serviceFileContent)

      const plugin = stewardWorkerPluginImpl()
      plugin.configResolved!(mockConfig as any)

      await plugin.buildStart!.call({} as any)

      // Should write registry file
      const registryCall = vi.mocked(fs.writeFile).mock.calls.find(call =>
        call[0].toString().includes('worker-registry.ts')
      )

      expect(registryCall).toBeDefined()
      const registryContent = registryCall![1] as string

      // Should contain worker import and bundle mapping
      expect(registryContent).toContain('import DataProcessingServiceWorker')
      expect(registryContent).toContain('?worker')
      expect(registryContent).toContain('DataProcessingService')
      expect(registryContent).toContain('getWorkerBundle')
    })

    it('should handle multiple services in registry', async () => {
      const firstServiceContent = `
        @withWorker('FirstWorker')
        export class FirstService extends Service {}
      `

      const secondServiceContent = `
        @withWorker('SecondWorker')
        export class SecondService extends Service {}
      `

      vi.mocked(glob).mockResolvedValue([
        '/test/project/src/services/FirstService.ts',
        '/test/project/src/services/SecondService.ts'
      ])

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(firstServiceContent)
        .mockResolvedValueOnce(secondServiceContent)

      const plugin = stewardWorkerPluginImpl()
      plugin.configResolved!(mockConfig as any)

      await plugin.buildStart!.call({} as any)

      const registryCall = vi.mocked(fs.writeFile).mock.calls.find(call =>
        call[0].toString().includes('worker-registry.ts')
      )

      const registryContent = registryCall![1] as string

      expect(registryContent).toContain('FirstService')
      expect(registryContent).toContain('SecondService')
      expect(registryContent).toContain('FirstServiceWorker')
      expect(registryContent).toContain('SecondServiceWorker')
    })
  })

  describe('virtual module resolution', () => {
    it('should resolve virtual worker modules', () => {
      const plugin = stewardWorkerPluginImpl()

      const result = plugin.resolveId!('virtual:steward-worker-TestService')
      expect(result).toBe('virtual:steward-worker-TestService')

      const nonVirtualResult = plugin.resolveId!('regular-module')
      expect(nonVirtualResult).toBeUndefined()
    })

    it('should load virtual worker module content', async () => {
      const serviceFileContent = `
        @withWorker('TestWorker')
        export class TestService extends Service {}
      `

      vi.mocked(glob).mockResolvedValue(['/test/project/src/services/TestService.ts'])
      vi.mocked(fs.readFile).mockResolvedValue(serviceFileContent)

      const plugin = stewardWorkerPluginImpl()
      plugin.configResolved!(mockConfig as any)

      // First, discover services
      await plugin.buildStart!.call({} as any)

      // Then, load virtual module
      const content = plugin.load!('virtual:steward-worker-TestService')

      expect(content).toBeDefined()
      if (typeof content === 'string') {
        expect(content).toContain('TestService')
        expect(content).toContain('registerWorkerService')
      }
    })
  })

  describe('error handling', () => {
    it('should handle file read errors gracefully', async () => {
      vi.mocked(glob).mockResolvedValue(['/test/project/src/services/ErrorService.ts'])
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'))

      const plugin = stewardWorkerPluginImpl()
      plugin.configResolved!(mockConfig as any)

      // Should not throw, just continue with empty service list
      await expect(plugin.buildStart!.call({} as any)).resolves.toBeUndefined()
    })

    it('should handle directory creation errors', async () => {
      const serviceFileContent = `
        @withWorker('TestWorker')
        export class TestService extends Service {}
      `

      vi.mocked(glob).mockResolvedValue(['/test/project/src/services/TestService.ts'])
      vi.mocked(fs.readFile).mockResolvedValue(serviceFileContent)
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('Permission denied'))

      const plugin = stewardWorkerPluginImpl()
      plugin.configResolved!(mockConfig as any)

      await expect(plugin.buildStart!.call({} as any)).rejects.toThrow('Permission denied')
    })
  })

  describe('debugging output', () => {
    it('should log debug messages when debug is enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const plugin = stewardWorkerPluginImpl({ debug: true })
      plugin.configResolved!(mockConfig as any)

      await plugin.buildStart!.call({} as any)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[steward-worker-plugin]')
      )

      consoleSpy.mockRestore()
    })

    it('should not log debug messages when debug is disabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const plugin = stewardWorkerPluginImpl({ debug: false })
      plugin.configResolved!(mockConfig as any)

      await plugin.buildStart!.call({} as any)

      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })
})