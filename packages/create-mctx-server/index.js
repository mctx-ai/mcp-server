#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Read version from own package.json
const selfPkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const version = selfPkg.version;

const projectName = process.argv[2];

if (!projectName) {
  console.error('Usage: npm create mctx-server <project-name>');
  process.exit(1);
}

if (existsSync(projectName)) {
  console.error(`Error: Directory "${projectName}" already exists`);
  process.exit(1);
}

// Create project directory
mkdirSync(projectName, { recursive: true });

// Generate package.json
const packageJson = {
  name: projectName,
  version: '0.0.1',
  type: 'module',
  scripts: {
    dev: 'npx mctx-dev index.js',
    build: "node --experimental-sea-config sea-config.json || echo 'Build step placeholder'",
  },
  dependencies: {
    '@mctx-ai/mcp-server': `^${version}`,
  },
  devDependencies: {
    '@mctx-ai/mcp-dev': `^${version}`,
  },
};

writeFileSync(
  join(projectName, 'package.json'),
  JSON.stringify(packageJson, null, 2) + '\n'
);

// Generate index.js
const indexJs = `import { createServer, T } from '@mctx-ai/mcp-server';

const app = createServer();

// A simple greeting tool
function greet({ name }) {
  return \`Hello, \${name}! Welcome to mctx.\`;
}
greet.description = 'Greet someone by name';
greet.input = {
  name: T.string({ required: true, description: 'Name to greet' }),
};
app.tool('greet', greet);

// Learn more: https://docs.mctx.ai/framework/tools

export default app;
`;

writeFileSync(join(projectName, 'index.js'), indexJs);

// Generate mctx.json
const mctxJson = {
  name: projectName,
  entrypoint: 'index.js',
};

writeFileSync(
  join(projectName, 'mctx.json'),
  JSON.stringify(mctxJson, null, 2) + '\n'
);

// Generate .gitignore
const gitignore = `node_modules/
dist/
`;

writeFileSync(join(projectName, '.gitignore'), gitignore);

// Generate README.md
const readme = `# ${projectName}

An MCP server built with [@mctx-ai/mcp-server](https://github.com/mctx-ai/mcp-server).

## Development

\`\`\`bash
npm install
npm run dev
\`\`\`

## Add a Tool

\`\`\`javascript
const myTool = ({ input }) => {
  return \`Result: \${input}\`;
};
myTool.description = 'What this tool does';
myTool.input = {
  input: T.string({ required: true, description: 'Input description' }),
};
app.tool('my-tool', myTool);
\`\`\`

## Deploy

1. Push to GitHub
2. Connect your repo at [mctx.ai](https://mctx.ai)
3. Deploy — mctx reads \`mctx.json\` and runs your server

## Learn More

- [Framework Docs](https://docs.mctx.ai/docs/building-mcp-servers/framework-getting-started)
- [API Reference](https://docs.mctx.ai/docs/building-mcp-servers/framework-api-reference)
- [MCP Specification](https://modelcontextprotocol.io)
`;

writeFileSync(join(projectName, 'README.md'), readme);

// Success message
console.log(`✓ Created ${projectName}

  cd ${projectName}
  npm install
  npm run dev

Learn more: https://docs.mctx.ai`);
