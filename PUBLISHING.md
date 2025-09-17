# Publishing Guide

This document outlines how to publish Steward packages to npm.

## Publishing Setup Complete ✅

### Package Metadata
- ✅ Author: Daniel Buckner
- ✅ License: MIT
- ✅ Repository: https://github.com/d-buckner/steward
- ✅ Homepage and bug tracker configured
- ✅ Engine requirements: Node.js >= 18.0.0
- ✅ Public access configured for scoped packages

### Semantic Versioning
- ✅ Changesets installed and configured
- ✅ GitHub Actions workflow for automated releases
- ✅ Scripts for version management:
  - `npm run changeset` - Create a changeset
  - `npm run version-packages` - Bump versions
  - `npm run release` - Build and publish

### Build System
- ✅ Turbo monorepo orchestration
- ✅ TypeScript declarations generated
- ✅ Both ESM and CommonJS outputs
- ✅ All 33 tests passing

## Publishing Workflow

### 1. Create a Changeset

When you make changes, document them:

```bash
npm run changeset
```

Choose change type:
- **patch** - Bug fixes, non-breaking changes
- **minor** - New features, backward compatible
- **major** - Breaking changes

### 2. Version Packages

When ready to release:

```bash
npm run version-packages
```

This updates package.json versions and generates CHANGELOG.md files.

### 3. Publish

```bash
npm run release
```

Or push to main branch and let GitHub Actions handle it automatically.

## GitHub Actions

The `.github/workflows/release.yml` workflow:
- Runs on every push to main
- Tests all packages
- Publishes to npm automatically
- Requires these secrets:
  - `NPM_TOKEN` - npm authentication token
  - `GITHUB_TOKEN` - automatically provided

## Package Structure

```
steward/
├── src/                    # Core @d-buckner/steward package
├── packages/
│   ├── react/              # @d-buckner/steward-react
│   └── solid/              # @d-buckner/steward-solid
├── docs/                   # Documentation
├── .changeset/             # Version management
└── .github/workflows/      # CI/CD
```

## Manual Publishing

If needed, you can publish manually:

```bash
# 1. Build everything
npm run build

# 2. Publish core package
npm publish

# 3. Publish React package
cd packages/react
npm publish

# 4. Publish SolidJS package
cd packages/solid
npm publish
```

## Documentation

Complete documentation is available:

- [README.md](./README.md) - Main overview and quick start
- [docs/getting-started.md](./docs/getting-started.md) - Comprehensive tutorial
- [docs/api.md](./docs/api.md) - Complete API reference  
- [docs/architecture.md](./docs/architecture.md) - Design principles
- [packages/react/README.md](./packages/react/README.md) - React integration
- [packages/solid/README.md](./packages/solid/README.md) - SolidJS integration

## Release Checklist

Before releasing:

- [ ] All tests pass (`npm run test:run`)
- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] All packages build (`npm run build`)
- [ ] Documentation is up to date
- [ ] Changeset created for changes
- [ ] Version bumped appropriately

## NPM Package Links

Once published, packages will be available at:

- [`@d-buckner/steward`](https://www.npmjs.com/package/@d-buckner/steward) - Core service architecture
- [`@d-buckner/steward-react`](https://www.npmjs.com/package/@d-buckner/steward-react) - React hooks and providers
- [`@d-buckner/steward-solid`](https://www.npmjs.com/package/@d-buckner/steward-solid) - SolidJS primitives

## Installation Commands

```bash
# Core package only
npm install @d-buckner/steward

# React integration
npm install @d-buckner/steward @d-buckner/steward-react

# SolidJS integration  
npm install @d-buckner/steward @d-buckner/steward-solid
```

## Support

- 🐛 [Issues](https://github.com/d-buckner/steward/issues)
- 📖 [Documentation](https://github.com/d-buckner/steward#readme)
- 💬 [Discussions](https://github.com/d-buckner/steward/discussions)