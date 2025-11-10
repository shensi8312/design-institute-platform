const WebSocket = require('ws')
const { URL } = require('url')

let instance = null

class DigitalSiteWebSocket {
  constructor(server) {
    this.wss = new WebSocket.Server({ server, path: '/ws/digital-site' })
    this.clients = new Map()
    this.initialize()
  }

  initialize() {
    this.wss.on('connection', (ws, req) => {
      const connectionId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const query = this.parseQuery(req)
      const clientInfo = {
        ws,
        siteId: query.siteId || null,
        userId: query.userId || null
      }
      this.clients.set(connectionId, clientInfo)

      ws.send(
        JSON.stringify({
          type: 'connection',
          payload: {
            message: '已连接到数字工地告警通道',
            siteId: clientInfo.siteId,
            timestamp: new Date().toISOString()
          }
        })
      )

      ws.on('message', (message) => {
        if (message.toString() === 'ping') {
          ws.send('pong')
        }
      })

      ws.on('close', () => {
        this.clients.delete(connectionId)
      })

      ws.on('error', (error) => {
        console.error('数字工地 WebSocket 错误:', error.message)
        this.clients.delete(connectionId)
      })
    })
  }

  parseQuery(req) {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`)
      const siteId = url.searchParams.get('siteId')
      const userId = url.searchParams.get('userId') || url.searchParams.get('token')
      return { siteId, userId }
    } catch (error) {
      return { siteId: null, userId: null }
    }
  }

  broadcast(type, payload, filter = {}) {
    const message = JSON.stringify({ type, payload })
    for (const { ws, siteId } of this.clients.values()) {
      if (ws.readyState !== WebSocket.OPEN) continue
      if (filter.siteId && siteId && siteId !== filter.siteId) continue
      ws.send(message)
    }
  }

  emitAlertCreated(alert) {
    this.broadcast('alert:new', alert, { siteId: alert.siteId })
  }

  emitAlertUpdated(alert) {
    this.broadcast('alert:update', alert, { siteId: alert.siteId })
  }

  emitStats(stats, siteId = null) {
    this.broadcast('alert:stats', stats, { siteId })
  }
}

function initDigitalSiteWebSocket(server) {
  if (!instance) {
    instance = new DigitalSiteWebSocket(server)
  }
  return instance
}

function getDigitalSiteWebSocket() {
  return instance
}

module.exports = {
  initDigitalSiteWebSocket,
  getDigitalSiteWebSocket,
  DigitalSiteWebSocket
}
