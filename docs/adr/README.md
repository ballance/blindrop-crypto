# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) documenting significant technical decisions made in the blindrop-crypto library.

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-use-aes-256-gcm-for-encryption.md) | Use AES-256-GCM for Encryption | Accepted | 2026-02-15 |
| [0002](0002-zero-knowledge-via-url-fragment.md) | Zero-Knowledge Architecture via URL Fragment | Accepted | 2026-02-15 |
| [0003](0003-atomic-redis-operations-with-lua.md) | Atomic Redis Operations with Lua Scripts | Accepted | 2026-02-15 |
| [0004](0004-web-crypto-api-no-dependencies.md) | Web Crypto API with Zero Runtime Dependencies | Accepted | 2026-02-15 |
| [0005](0005-typed-error-hierarchy.md) | Typed Error Hierarchy for Exception Handling | Accepted | 2026-02-15 |
| [0006](0006-format-versioning-for-compatibility.md) | Format Versioning for Future Compatibility | Accepted | 2026-02-15 |

## About ADRs

Architecture Decision Records capture important architectural decisions along with their context and consequences. They serve as:

- **Documentation**: Explain why the code is structured the way it is
- **Onboarding**: Help new contributors understand design rationale
- **History**: Preserve context that might otherwise be lost

## Format

Each ADR follows this structure:

- **Status**: Proposed, Accepted, Deprecated, or Superseded
- **Context**: The situation and constraints that led to the decision
- **Decision**: What we decided to do
- **Consequences**: The resulting impact, both positive and negative

## Security Decisions

Several ADRs are security-critical:

- **ADR-0001**: Encryption algorithm selection
- **ADR-0002**: Zero-knowledge architecture design
- **ADR-0003**: Race condition prevention
- **ADR-0004**: Supply chain risk mitigation

These decisions should be reviewed before any changes to the cryptographic implementation.
