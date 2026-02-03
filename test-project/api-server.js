const http = require('http');

const PORT = 4000;

const server = http.createServer((req, res) => {
  const start = Date.now();
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url === '/api') {
    const body = JSON.stringify({ message: 'hello from api', port: server.address().port });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
    console.log(`[api-server] ${req.method} ${req.url} → 200 (${Date.now() - start}ms)`);
  } else {
    res.writeHead(404);
    res.end('Not found');
    console.log(`[api-server] ${req.method} ${req.url} → 404 (${Date.now() - start}ms)`);
  }
});

server.listen(PORT, () => {
  console.log(`[api-server] Listening on port ${server.address().port}`);
});
