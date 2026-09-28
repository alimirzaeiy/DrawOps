# Contributing to Server Manager

Thank you for your interest in contributing! 🎉

## Getting Started

1. **Fork** this repository
2. **Clone** your fork locally
3. **Install dependencies:**
   ```bash
   npm install
   npm --prefix backend install
   npm --prefix frontend install
   ```
4. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feat/my-feature
   ```
5. **Run the development server:**
   ```bash
   npm run dev
   ```

## Development Guidelines

### Code Style
- Use **TypeScript** for all new code
- Follow existing patterns and naming conventions
- Use **Tailwind CSS** for styling (follow the terminal theme palette)

### Safety Rules (MANDATORY)
These rules are **non-negotiable** and must be preserved in all contributions:

1. **Zero-Delete Policy** — Never add any code that deletes files or containers on remote servers
2. **Command Whitelist** — Only safe, non-destructive commands are allowed through SSH
3. **Mandatory Backup** — All file edits must create a backup in `/home/<user>/srv_backups/` before saving
4. **RAM-Only Passwords** — Sudo passwords must never be written to disk or database

### Testing
Before submitting a PR, run the security tests:
```bash
cd backend
npx tsx src/__tests__/securityGuardian.test.ts
```

## Pull Request Process

1. Ensure your code follows the existing style and conventions
2. Update documentation if you've changed any behavior
3. Run tests and verify they pass
4. Write a clear PR description explaining what and why

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` — New feature
- `fix:` — Bug fix
- `refactor:` — Code refactoring
- `docs:` — Documentation changes
- `chore:` — Build/tooling changes

## Reporting Issues

When reporting a bug, please include:
- Steps to reproduce
- Expected vs actual behavior
- Your OS and Node.js version
- Screenshots if applicable (especially for UI issues)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
