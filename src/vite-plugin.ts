/**
 * Vite plugin for Steward framework worker bundle generation
 * Implements complete build-time worker bundle generation with individual worker bundles
 */

import { build, type Plugin } from 'vite';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { glob } from 'glob';

export interface StewardPluginOptions {
    /**
     * Pattern to match service files
     * @default "src/**\/*.{ts,tsx}"
     */
    include?: string | string[];
    /**
     * Directory to output worker bundles (relative to build output)
     * @default "workers"
     */
    workerOutDir?: string;
    /**
     * Directory to output generated registry (relative to src)
     * @default "generated"
     */
    registryOutDir?: string;
    /**
     * Enable debug logging
     * @default false
     */
    debug?: boolean;
}

interface ServiceMetadata {
    className: string;
    filePath: string;
    importPath: string;
    decoratorName: string;
}

export function stewardWorkerPlugin(options: StewardPluginOptions = {}): Plugin {
  const {
    include = "src/**/*.{ts,tsx}",
    workerOutDir = "workers",
    debug = false
  } = options;

  let config: any;

  const log = (message: string): void => {
    if (debug) {
      console.log(`[steward-worker-plugin] ${message}`);
    }
  };

  let discoveredServices: ServiceMetadata[] = [];

  return {
    name: 'steward-worker-plugin',

    configResolved(resolvedConfig) {
      config = resolvedConfig;
      log(`Vite config resolved, mode: ${config.command}`);
    },

    async buildStart() {
      log('Starting worker service discovery...');

      try {
        discoveredServices = await discoverServices(include, config.root);
        log(`Discovered ${discoveredServices.length} worker services`);

        if (discoveredServices.length === 0) {
          log('No worker services found, skipping registry generation');
          return;
        }

        // Note: Registry generation removed - WorkerProxy now derives URLs directly from decorator names

      } catch (error) {
        console.error('[steward-worker-plugin] Service discovery failed:', error);
        throw error;
      }
    },

    async generateBundle() {
      if (discoveredServices.length === 0) {
        return;
      }

      log('Starting worker bundling...');

      try {
        // Create temporary directory for worker entry files
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'steward-workers-'));
        log(`Created temp directory: ${tempDir}`);

        // Ensure dist worker directory exists
        const distWorkersDir = path.join(config.root, 'dist', workerOutDir);
        await fs.mkdir(distWorkersDir, { recursive: true });

        try {
          // Generate and bundle each worker
          for (const service of discoveredServices) {
            await bundleWorker(service, tempDir, distWorkersDir, config, log);
          }

          log('Worker bundling complete!');

        } finally {
          // Keep temp directory for debugging
          log(`Temp directory preserved for debugging: ${tempDir}`);
        }

      } catch (error) {
        console.error('[steward-worker-plugin] Worker bundling failed:', error);
        throw error;
      }
    },

  };
}

// Inline implementation of service discovery
async function discoverServices(include: string | string[], rootDir: string): Promise<ServiceMetadata[]> {
  const patterns = Array.isArray(include) ? include : [include];
  const services: ServiceMetadata[] = [];

  for (const pattern of patterns) {
    const files = await glob(pattern, { cwd: rootDir, absolute: true });

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const fileServices = await parseFileForWorkerServices(content, file);
        services.push(...fileServices);
      } catch (error) {
        console.warn(`[steward-worker-plugin] Failed to parse file ${file}:`, error);
      }
    }
  }

  return services;
}

// Inline implementation of service parsing
async function parseFileForWorkerServices(content: string, filePath: string): Promise<ServiceMetadata[]> {
  const services: ServiceMetadata[] = [];

  // Find all @withWorker decorators
  const decoratorRegex = /@withWorker\s*\(\s*(?:['"`]([^'"`]+)['"`]|\{\s*name:\s*['"`]([^'"`]+)['"`]\s*\})\s*\)/g;
  const decoratorMatches: Array<{ name: string; index: number }> = [];

  let match: RegExpExecArray | null;
  while ((match = decoratorRegex.exec(content)) !== null) {
    const name = match[1] || match[2]; // Handle both string and object syntax
    decoratorMatches.push({ name, index: match.index });
  }

  // Find all export class declarations that extend Service
  const classRegex = /export\s+class\s+(\w+)\s+extends\s+Service/g;
  const classMatches: Array<{ className: string; index: number }> = [];

  while ((match = classRegex.exec(content)) !== null) {
    classMatches.push({ className: match[1], index: match.index });
  }

  // Match decorators to classes (decorator should come before class)
  for (const decorator of decoratorMatches) {
    // Find the next class after this decorator
    const nextClass = classMatches.find(cls => cls.index > decorator.index);
    if (nextClass) {
      // Create absolute import path for the service file that Vite can resolve
      const serviceImportPath = filePath.replace(/\.(ts|tsx)$/, '');

      services.push({
        className: nextClass.className,
        filePath,
        importPath: serviceImportPath,
        decoratorName: decorator.name
      });
    }
  }

  return services;
}

// Inline implementation of worker entry file generation
function generateWorkerEntryFile(metadata: ServiceMetadata): string {
  const { className, importPath } = metadata;

  return `// Auto-generated worker entry for ${className}
import { ${className} } from '${importPath}';

console.log('[Worker] 🚀 Self-contained worker starting...');
console.log('[Worker] 📦 ${className} imported');

// Create service instance - it will automatically handle worker communication
const serviceInstance = new ${className}();
console.log('[Worker] ✅ Service instance created and ready');
`;
}

// Worker bundling logic
async function bundleWorker(service: ServiceMetadata, tempDir: string, distWorkersDir: string, config: any, log: (msg: string) => void): Promise<void> {
  const workerName = service.decoratorName.replace(/[^a-zA-Z0-9_-]/g, '-');
  const workerFileName = `${workerName}.worker`;

  // Generate worker entry file in temp directory
  const tempWorkerPath = path.join(tempDir, `${workerFileName}.ts`);
  const workerCode = generateWorkerEntryFile(service);
  await fs.writeFile(tempWorkerPath, workerCode);
  log(`Generated temp worker entry: ${tempWorkerPath}`);

  // Bundle the worker using Vite build API
  const outputPath = path.join(distWorkersDir, `${workerFileName}.js`);

  try {
    await build({
      configFile: false,
      build: {
        lib: {
          entry: tempWorkerPath,
          name: `${service.className}Worker`,
          fileName: () => `${workerFileName}.js`,
          formats: ['es']
        },
        outDir: distWorkersDir,
        emptyOutDir: false,
        rollupOptions: {
          output: {
            entryFileNames: `${workerFileName}.js`,
            format: 'es'
          },
          // Externalize the old worker runtime modules to prevent bundling them
          external: [
            '@d-buckner/steward/worker/worker-runtime',
            '@d-buckner/steward/worker/worker-registry',
            '@d-buckner/steward/worker/PureMailboxWorkerRuntime'
          ]
        },
        target: 'esnext',
        minify: false,
        sourcemap: config.command === 'serve'
      },
      logLevel: 'warn'
    });

    log(`Bundled worker: ${outputPath}`);

    // Verify the file was actually created
    try {
      const stats = await fs.stat(outputPath);
      log(`Worker file verified: ${stats.size} bytes`);
    } catch (error) {
      log(`ERROR: Worker file not found at ${outputPath}: ${(error as Error).message}`);
    }
  } catch (error) {
    console.error(`[steward-worker-plugin] Failed to bundle worker ${workerName}:`, error);
    throw error;
  }
}

export default stewardWorkerPlugin;