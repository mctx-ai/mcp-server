#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

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
    '@mctx-ai/mcp-server': '^0.1.0',
  },
  devDependencies: {
    '@mctx-ai/mcp-dev': '^0.1.0',
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

// Success message
console.log(`✓ Created ${projectName}

  cd ${projectName}
  npm install
  npm run dev

Learn more: https://docs.mctx.ai`);
