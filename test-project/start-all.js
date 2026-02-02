const { spawn } = require('child_process');
const path = require('path');

const children = [];

function startChild(script) {
  const child = spawn('node', [path.join(__dirname, script)], {
    stdio: 'inherit',
    env: process.env,
  });
  children.push(child);
  child.on('exit', (code) => {
    console.log(`[start-all] ${script} exited with code ${code}`);
  });
}

startChild('api-server.js');
startChild('web-server.js');

process.on('SIGTERM', () => {
  children.forEach((c) => c.kill('SIGTERM'));
  process.exit(0);
});

process.on('SIGINT', () => {
  children.forEach((c) => c.kill('SIGTERM'));
  process.exit(0);
});

console.log('[start-all] Started api-server and web-server');
