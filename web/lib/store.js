// Server-side in-memory event store + SSE client management
// Works with single-server deployment (next dev / next start)

let eventCounter = 0
const eventLog = []
const clients = new Set()

export function getEventLog() {
  return eventLog
}

export function getEventsSince(lastId) {
  return eventLog.filter(e => e.id > lastId)
}

export function addClient(fn) {
  clients.add(fn)
}

export function removeClient(fn) {
  clients.delete(fn)
}

function broadcast(event) {
  event.id = ++eventCounter
  event.serverTimestamp = Date.now()
  eventLog.push(event)

  for (const client of clients) {
    try {
      client(event)
    } catch {
      clients.delete(client)
    }
  }
}

export function handleStart(payload) {
  broadcast({ type: 'start', ...payload })
}

export function handleStep(payload) {
  broadcast({ type: 'step', ...payload })
}

export function handlePush(payload) {
  broadcast({ type: 'push', ...payload })
}

export function handleDeployment(payload) {
  broadcast({ type: 'deployment', ...payload })
}
