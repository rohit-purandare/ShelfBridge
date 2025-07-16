# ShelfBridge Performance & Debugging Tools

This directory contains specialized tools for analyzing and optimizing ShelfBridge performance.

## Tools Overview

### 🚀 Performance Timing Profiler (`timing-profiler.js`)

A comprehensive performance analysis tool that instruments key operations to identify bottlenecks.

**Quick Start:**
```bash
# Basic profiling (simulated operations)
npm run profile

# Profile specific user
npm run profile -- sync alice

# Real sync with profiling
PROFILE_MODE=real node tools/timing-profiler.js sync alice

# Cache operations only
npm run profile-cache
```

**Features:**
- Real-time timing feedback with visual indicators
- Detailed performance categorization (fast/slow/very slow)
- Optimization suggestions based on timing data
- Simulation mode for safe testing
- Real sync mode for production analysis

**Documentation:** See [Performance Timing Profiler](../wiki/technical/TIMING-PROFILER.md)

### 🔗 HTTP Performance Tester (`test-performance-improvement.js`)

Tests HTTP connection reuse improvements and measures performance gains.

**Usage:**
```bash
# Test connection reuse performance
npm run test-performance

# Direct execution
node tools/test-performance-improvement.js
```

**Features:**
- Tests HTTP keep-alive connection reuse
- Measures timing improvements
- Compares before/after performance
- Validates API optimization effectiveness

## Performance Optimization

For detailed information about performance improvements and HTTP optimization, see:
- [Performance Optimization Guide](../wiki/technical/consolidation-improvements.md)
- [Performance Timing Profiler Documentation](../wiki/technical/TIMING-PROFILER.md)

## Integration with Main Application

These tools are integrated with the main ShelfBridge application through npm scripts:

```json
{
  "scripts": {
    "profile": "node tools/timing-profiler.js",
    "profile-cache": "node tools/timing-profiler.js cache", 
    "test-performance": "node tools/test-performance-improvement.js"
  }
}
```

## Development

When adding new performance tools:

1. Place the tool script in this `tools/` directory
2. Add an npm script to `package.json`
3. Update documentation in the `wiki/technical/` directory
4. Update the wiki Home page with links to the new documentation 