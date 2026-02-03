const http = require('http');

const PORT = 4100;
const API_PORT = 4000;

function getHtml(webPort) {
  const apiUrl = process.env.API_URL || 'not set';
  const webUrl = process.env.WEB_URL || 'not set';
  return `<!DOCTYPE html>
<html>
<head>
  <title>Test Project</title>
  <style>
    body { font-family: system-ui; max-width: 500px; margin: 80px auto; background: #111; color: #eee; }
    button { padding: 10px 20px; font-size: 16px; cursor: pointer; background: #2563eb; color: white; border: none; border-radius: 6px; }
    button:hover { background: #1d4ed8; }
    pre { background: #222; padding: 16px; border-radius: 6px; white-space: pre-wrap; min-height: 40px; }
  </style>
</head>
<body>
  <h1>Test Project</h1>
  <p>Web server port: <strong>${webPort}</strong> | API port: <strong>${apiUrl}</strong></p>
  <p>API_URL: <strong>${apiUrl}</strong> | WEB_URL: <strong>${webUrl}</strong></p>
  <button onclick="pingApi()">Ping API</button>
  <pre id="result">Click the button to ping the API server</pre>
  <script>
    async function pingApi() {
      const el = document.getElementById('result');
      el.textContent = 'Pinging...';
      try {
        const res = await fetch('/api');
        const data = await res.json();
        el.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        el.textContent = 'Error: ' + err.message;
      }
    }
  </script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const start = Date.now();
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(getHtml(server.address().port));
    console.log(`[web-server] ${req.method} ${req.url} → 200 (${Date.now() - start}ms)`);
  } else if (req.url === '/api' || req.url.startsWith('/api/')) {
    // Proxy /api to api-server (validates port-hook connect patching)
    const apiReq = http.request(
      { hostname: 'localhost', port: API_PORT, path: req.url, method: 'GET' },
      (apiRes) => {
        let body = '';
        apiRes.on('data', (chunk) => { body += chunk; });
        apiRes.on('end', () => {
          let apiResponse;
          try { apiResponse = JSON.parse(body); } catch { apiResponse = body; }
          res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            webPort: server.address().port,
            apiResponse,
          }));
          console.log(`[web-server] ${req.method} ${req.url} → ${apiRes.statusCode} (${Date.now() - start}ms)`);
        });
      },
    );
    apiReq.on('error', (err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      console.log(`[web-server] ${req.method} ${req.url} → 500 ${err.message} (${Date.now() - start}ms)`);
    });
    apiReq.end();
  } else {
    res.writeHead(404);
    res.end('Not found');
    console.log(`[web-server] ${req.method} ${req.url} → 404 (${Date.now() - start}ms)`);
  }
});

server.listen(PORT, () => {
  console.log(`[web-server] Listening on http://localhost:${server.address().port}`);
});
