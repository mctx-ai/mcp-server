# mctx-ai/mcp-server CLAUDE.md

Project-specific conventions and requirements for the mcp-server monorepo.

---

## GitHub Actions: SHA Pinning (Mandatory)

All GitHub Actions MUST use commit SHA references, never version tags or branch references. This is a supply chain security requirement to prevent tag-based attacks and ensure reproducible CI/CD pipelines.

### Correct — SHA-pinned with version tag comment

```yaml
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
- uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2
```

Note: npm is included with Node.js, so no additional setup action is required.

### Wrong — tag or branch reference (not allowed)

```yaml
# Never use tags
- uses: actions/checkout@v4
- uses: actions/setup-node@v4

# Never use branches
- uses: actions/checkout@main
```

**How to find the SHA:** Use GitHub's action lookup tool or check the action's release page for the commit SHA of your desired version. Always include the version tag as a comment for readability.
