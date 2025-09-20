/**
 * Demo-specific worker entry point
 * This imports the framework worker runtime AND the demo services that need to run in workers
 */

// Import framework worker runtime
import '@d-buckner/steward/worker/worker-runtime'

// Import all services that might be used in workers
// This ensures they get compiled into the worker bundle and their decorators run
import './services/DataProcessingService'

// The worker runtime will now be able to resolve DataProcessingService
// because it was imported and its @withWorker decorator ran in this context