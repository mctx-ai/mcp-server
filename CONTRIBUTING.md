# Contributing to @mctx-ai/mcp-server

Thank you for your interest in contributing! We welcome contributions from the community.

## Development Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/mctx-ai/mcp-server.git
   cd mcp-server
   ```

2. **Install pnpm (if not already installed):**

   ```bash
   npm install -g pnpm
   ```

3. **Install dependencies:**

   ```bash
   pnpm install
   ```

4. **Build all packages:**

   ```bash
   pnpm run build
   ```

5. **Run tests:**
   ```bash
   pnpm test
   ```

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) for clear and consistent commit messages.

**Format:** `<type>(<scope>): <description>`

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring (no functional changes)
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (dependencies, build config)
- `perf`: Performance improvements

**Examples:**

```
feat(server): add middleware support
fix(dev): resolve hot reload race condition
docs: update quick start example
```

## Pull Request Process

1. **Create a branch** from `main`:

   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** and ensure:
   - Code follows existing patterns
   - Tests pass (`pnpm test`)
   - Build succeeds (`pnpm run build`)
   - Code is formatted (`pnpm run format`)

3. **Sign your commits** with Developer Certificate of Origin:

   ```bash
   git commit -s -m "feat: your commit message"
   ```

   This adds a `Signed-off-by` line to your commit message, certifying that you have the right to submit the work under the project's license.

4. **Push your branch** and create a pull request:
   - Provide a clear description of the changes
   - Reference any related issues
   - Ensure CI checks pass

5. **Code review:**
   - Maintainers will review your PR
   - Address any feedback or requested changes
   - Once approved, your PR will be merged

## Developer Certificate of Origin (DCO)

By contributing, you certify that:

1. The contribution was created in whole or in part by you and you have the right to submit it under the open source license indicated in the file; or
2. The contribution is based upon previous work that, to the best of your knowledge, is covered under an appropriate open source license and you have the right under that license to submit that work with modifications, whether created in whole or in part by you, under the same open source license (unless you are permitted to submit under a different license); or
3. The contribution was provided directly to you by some other person who certified (1), (2) or (3) and you have not modified it.

To sign your commits, use `git commit -s` or add the following line to your commit message:

```
Signed-off-by: Your Name <your.email@example.com>
```

## Questions?

If you have questions or need help, feel free to:

- Open an issue for discussion
- Ask in pull request comments
- Check the documentation at https://docs.mctx.ai

We appreciate your contributions!
