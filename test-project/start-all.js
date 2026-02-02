const { spawn, execFile } = require('child_process');
const path = require('path');

const WEB_PORT = 4100;
const offset = parseInt(process.env.__WM_PORT_OFFSET__ || '0', 10);
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

const url = `http://localhost:${WEB_PORT + offset}`;
console.log(`[start-all] Started api-server and web-server`);

// Give servers a moment to bind, then open browser
setTimeout(() => {
  const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  execFile(openCmd, [url]);
  console.log(`[start-all] Opened ${url}`);
}, 1000);
