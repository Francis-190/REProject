// ── sse-emitter.js ────────────────────────────────────────────────────────────
// Thin wrapper around global.__sseClients so service.js stays clean.
// Usage:
//   const { sseEmit, sseDone, sseError } = require('./sse-emitter');
//   sseEmit(sessionId, 'region_done', { regionCodes, results, progress });
//   sseDone(sessionId, { succeeded, failed, total });
//   sseError(sessionId, 'Something went wrong');
// ─────────────────────────────────────────────────────────────────────────────

function _send(sessionId, event, data) {
  const clients = global.__sseClients;
  if (!clients) return false;

  const res = clients.get(sessionId);
  if (!res) return false;

  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if (res.flush) res.flush();   // flush compressed / proxied streams
    return true;
  } catch (e) {
    console.warn(`[SSE] Write failed for session ${sessionId}:`, e.message);
    clients.delete(sessionId);
    return false;
  }
}

/**
 * Emit a partial-result event (region_done).
 * @param {string} sessionId
 * @param {string[]} regionCodes  - regions that just finished
 * @param {any[]}   results       - rows produced (success + failure mixed)
 * @param {{sent:number, total:number}} progress
 */
function sseEmit(sessionId, regionCodes, results, progress) {
  return _send(sessionId, 'region_done', { regionCodes, results, progress });
}

/**
 * Emit the final "complete" event and close the SSE connection.
 * @param {string} sessionId
 * @param {any[]}  succeeded
 * @param {any[]}  failed
 * @param {number} total
 */
function sseDone(sessionId, succeeded, failed, total) {
  _send(sessionId, 'complete', { succeeded, failed, total });

  // Close the response so the browser knows the stream ended
  const res = global.__sseClients?.get(sessionId);
  if (res) {
    try { res.end(); } catch (_) {}
    global.__sseClients.delete(sessionId);
  }
}

/**
 * Emit an error event (partial failure — stream stays open for retries).
 * @param {string} sessionId
 * @param {string} message
 */
function sseError(sessionId, message) {
  return _send(sessionId, 'error', { message });
}

module.exports = { sseEmit, sseDone, sseError };