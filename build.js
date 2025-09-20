// Build-time exports for Steward framework
// This module contains build tools and should only be imported during build time, not in browser code

const { stewardWorkerPlugin } = require('./dist/steward.cjs')

module.exports = {
  stewardWorkerPlugin
}