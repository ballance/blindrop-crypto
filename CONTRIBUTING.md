# Contributing to blindrop-crypto

Thank you for your interest in contributing to blindrop-crypto!

## Getting Started

```bash
# Clone the repository
git clone https://github.com/ballance/blindrop-crypto.git
cd blindrop-crypto

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

## Development Workflow

1. **Fork** the repository
2. **Create a branch** for your feature or fix
3. **Write tests** for new functionality
4. **Ensure all tests pass**: `npm test`
5. **Submit a pull request**

## Code Style

- TypeScript strict mode
- Functional patterns preferred
- Explicit error handling
- Meaningful variable names over comments

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `test:` - Test additions or fixes
- `chore:` - Maintenance tasks

## Testing

- All new code requires tests
- Property-based tests encouraged (we use fast-check)
- Security-critical code requires comprehensive edge case coverage

```bash
# Run tests
npm test

# Run tests in watch mode
npm test -- --watch
```

## Security

This is a cryptography library. Security is paramount.

- **Do not** introduce runtime dependencies without discussion
- **Do not** implement custom cryptographic primitives
- **Do** use Web Crypto API for all cryptographic operations
- **Do** validate all inputs at function boundaries

For security vulnerabilities, see [SECURITY.md](SECURITY.md).

## Architecture Decisions

Major decisions are documented in [docs/adr/](docs/adr/). Please review before proposing architectural changes.

## Questions?

Open an issue for questions or discussion.
