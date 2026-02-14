<p align="center">
  <img src="https://mctx.ai/brand/logo-purple.png" alt="mctx logo" width="200"/>
</p>

<p align="center">
  <strong>Free MCP Hosting. Set Your Price. Get Paid.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@mctx-ai/mcp-server"><img src="https://img.shields.io/npm/v/@mctx-ai/mcp-server" alt="npm version"/></a>
  <a href="https://www.npmjs.com/package/@mctx-ai/mcp-server"><img src="https://img.shields.io/npm/l/@mctx-ai/mcp-server" alt="license"/></a>
  <a href="https://github.com/mctx-ai/mcp-server/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/mctx-ai/mcp-server/ci.yml" alt="CI"/></a>
</p>

Build MCP servers with an Express-like API — no protocol knowledge required.

## Mental Models

- **Tools** = "I do something"
- **Resources** = "I have something"
- **Prompts** = "I suggest a conversation"

## Quick Start

```bash
npm install @mctx-ai/mcp-server
```

```javascript
import { createServer, T } from '@mctx-ai/mcp-server';

const app = createServer();

function greet({ name }) {
  return `Hello, ${name}! Welcome to mctx.`;
}
greet.description = 'Greet someone by name';
greet.input = {
  name: T.string({ required: true, description: 'Name to greet' }),
};
app.tool('greet', greet);

export default app;
```

## Links

- [Documentation](https://docs.mctx.ai)
- [Example Server](https://github.com/mctx-ai/example-mcp-server)
- [Contributing](CONTRIBUTING.md)

---

<p align="center">
  mctx is a trademark of mctx, Inc.<br/>
  Licensed under MIT
</p>
