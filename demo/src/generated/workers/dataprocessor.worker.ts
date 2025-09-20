// Auto-generated worker entry for DataProcessingService
console.log('[Worker] 🚀 Worker entry script starting...')

// Import service first
import { DataProcessingService } from '../../services/DataProcessingService'
console.log('[Worker] 📦 DataProcessingService imported:', DataProcessingService)

// Import registerWorkerService from separate registry module (no auto-initialization)
import { registerWorkerService } from '@d-buckner/steward/worker/worker-registry'
console.log('[Worker] 📝 registerWorkerService imported from registry')

// Register the service BEFORE initializing runtime
console.log('[Worker] 🔄 About to register service...')
registerWorkerService('DataProcessingService', DataProcessingService)
console.log('[Worker] ✅ DataProcessingService registered in registry')

// NOW import the runtime which will initialize with the service already registered
import '@d-buckner/steward/worker/worker-runtime'
console.log('[Worker] 🔧 Worker runtime imported and initialized')
