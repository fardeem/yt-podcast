#!/usr/bin/env bash

# Exit on error
set -e

echo "🔨 Building yt-podcast for npx usage..."

# Clean previous builds
rm -rf dist

# Create dist directory
mkdir -p dist

# Build the main entry point with bun
echo "📦 Bundling with bun..."
bun build src/main-ink.ts \
  --target node \
  --outfile dist/cli.js \
  --external react \
  --external ink \
  --external @inkjs/ui

# Add shebang to the built file
echo "✏️  Adding shebang..."
echo '#!/usr/bin/env node' | cat - dist/cli.js > temp && mv temp dist/cli.js

# Make the file executable
chmod +x dist/cli.js

# Create a wrapper script to ensure proper TTY handling
echo "📝 Creating TTY wrapper..."
cat > dist/cli-wrapper.js << 'EOF'
#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure we're running in a TTY environment
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  // Try to allocate a pseudo-TTY if possible
  const cliPath = join(__dirname, 'cli.js');
  
  // Use script command to allocate a TTY (works on macOS and Linux)
  const isWindows = process.platform === 'win32';
  
  if (isWindows) {
    // On Windows, just run directly - npx usually works fine there
    await import('./cli.js');
  } else {
    // On Unix-like systems, use script to allocate a TTY
    const child = spawn('script', ['-q', '/dev/null', process.execPath, cliPath], {
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' }
    });
    
    child.on('exit', (code) => {
      process.exit(code || 0);
    });
  }
} else {
  // We have a TTY, run normally
  await import('./cli.js');
}
EOF

chmod +x dist/cli-wrapper.js

# Copy necessary files
echo "📋 Copying additional files..."
cp README.md dist/ 2>/dev/null || true
cp LICENSE dist/ 2>/dev/null || true

echo "✅ Build complete!"
echo "📊 Build artifacts:"
ls -la dist/