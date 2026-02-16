# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in blindrop-crypto, please report it responsibly.

### How to Report

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email security concerns to: **security@bastionforge.com**

Include the following in your report:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours of your report
- **Initial Assessment**: Within 7 days
- **Resolution Timeline**: Depends on severity
  - Critical: 24-72 hours
  - High: 1-2 weeks
  - Medium: 2-4 weeks
  - Low: Next release cycle

### Disclosure Policy

- We follow coordinated disclosure
- We will credit reporters in release notes (unless anonymity requested)
- We request 90 days before public disclosure to allow patching

## Security Best Practices

When using blindrop-crypto:

1. **Never log keys or plaintext** - Only log ciphertext and IVs
2. **Use HTTPS** - Ensure URLs containing key fragments are transmitted securely
3. **Set appropriate TTLs** - Secrets should expire
4. **Limit views** - Use view counting to reduce exposure window
5. **Validate on server** - Never trust client-side validation alone

## Cryptographic Details

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Size**: 256 bits (32 bytes)
- **IV Size**: 96 bits (12 bytes), randomly generated per encryption
- **Implementation**: Web Crypto API (native browser/Node.js)

See [ADR-0001](docs/adr/0001-use-aes-256-gcm-for-encryption.md) for algorithm selection rationale.
