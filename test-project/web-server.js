const http = require('http');

const PORT = 4100;
const API_PORT = 4000;

const server = http.createServer((req, res) => {
  // Fetch from the api-server — the port-hook should redirect this connection
  const apiReq = http.request(
    { hostname: 'localhost', port: API_PORT, path: '/api', method: 'GET' },
    (apiRes) => {
      let body = '';
      apiRes.on('data', (chunk) => { body += chunk; });
      apiRes.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          webPort: server.address().port,
          apiResponse: JSON.parse(body),
        }));
      });
    },
  );
  apiReq.on('error', (err) => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });
  apiReq.end();
});

server.listen(PORT, () => {
  console.log(`[web-server] Listening on port ${server.address().port}`);
});
