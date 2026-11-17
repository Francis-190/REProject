const cds = require('@sap/cds');
const bodyParser = require('body-parser');
const cors = require('cors');
const proxy = require('@sap/cds-odata-v2-adapter-proxy');

// ── In-memory SSE client registry ─────────────────────────────────────────────
// Key: sessionId (string), Value: Express res object
const sseClients = new Map();

// Expose so service.js can emit events
global.__sseClients = sseClients;

cds.on('bootstrap', app => {
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
  app.use(bodyParser.text({ type: 'multipart/mixed', limit: '50mb' }));

  const corsOptions = {
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, Postman, etc.)
      if (!origin) return callback(null, true);
      // Dynamically reflect the requesting origin back
      callback(null, origin);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  };

  console.log('[CORS] Dynamic origin mode enabled');

  app.use(cors(corsOptions));

  // Handle preflight OPTIONS requests explicitly for all routes
  app.options('*', cors(corsOptions));

  app.use(proxy());

  // ── SSE subscription endpoint ──────────────────────────────────────────────
  // Frontend connects to: GET /sse/progress?sessionId=<uuid>
  app.get('/sse/progress', (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering

    res.flushHeaders();

    // Register client
    sseClients.set(sessionId, res);
    console.log(`[SSE] Client connected: ${sessionId}`);

    // Send an initial heartbeat so the browser knows it's connected
    res.write(`event: connected\ndata: {"sessionId":"${sessionId}"}\n\n`);

    // Heartbeat every 20s to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 20000);

    // Cleanup on disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(sessionId);
      console.log(`[SSE] Client disconnected: ${sessionId}`);
    });
  });
});