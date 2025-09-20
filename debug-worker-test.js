// Simple test script to debug worker issues
// Run this in the browser console

console.log('Starting worker debug test...');

// Try to access the demo app's container and trigger the action
try {
  // Get the service container from the global scope if available
  if (window.demoContainer) {
    console.log('Found demo container:', window.demoContainer);

    // Try to resolve the DataProcessingService
    const service = window.demoContainer.resolve(window.DataProcessingToken);
    console.log('Resolved service:', service);
    console.log('Service constructor:', service.constructor.name);
    console.log('Service methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(service)));

    // Try to call startProcessing directly
    if (typeof service.send === 'function') {
      console.log('Calling service.send with startProcessing...');
      service.send('startProcessing', [[1, 2, 3], 'sum'])
        .then(result => console.log('Direct send result:', result))
        .catch(error => console.error('Direct send error:', error));
    }
  } else {
    console.log('No global demo container found');
  }
} catch (error) {
  console.error('Error in worker debug test:', error);
}