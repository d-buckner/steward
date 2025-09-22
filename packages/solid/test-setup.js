import { configure } from '@solidjs/testing-library';

// Configure SolidJS testing library for DOM environment
configure({
  asyncUtilTimeout: 5000
});

// Ensure DOM globals are available
Object.defineProperty(globalThis, 'window', {
  value: global.window,
  writable: true
});

// Mock browser APIs that might be missing in jsdom
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: ''
  },
  writable: true
});