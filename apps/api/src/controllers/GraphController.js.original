const GraphService = require('../services/system/GraphService')

class GraphController {
  constructor() {
    this.graphService = new GraphService()
  }

  async getGraphs(req, res) {
    try {
      const result = await this.graphService.list(
        req.user.id,
        req.user.organization_id,
        req.query
      )
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '获取图谱列表失败', error: error.message })
    }
  }

  async getGraph(req, res) {
    try {
      const result = await this.graphService.getById(req.params.id)
      if (result.success) {
        res.json(result)
      } else {
        res.status(404).json(result)
      }
    } catch (error) {
      res.status(500).json({ success: false, message: '获取图谱失败', error: error.message })
    }
  }

  async createGraph(req, res) {
    try {
      const data = {
        ...req.body,
        created_by: req.user.id,
        organization_id: req.user.organization_id
      }
      const result = await this.graphService.create(data)
      res.status(201).json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '创建图谱失败', error: error.message })
    }
  }

  async updateGraph(req, res) {
    try {
      const result = await this.graphService.update(req.params.id, req.body)
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '更新图谱失败', error: error.message })
    }
  }

  async deleteGraph(req, res) {
    try {
      const result = await this.graphService.delete(req.params.id)
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '删除图谱失败', error: error.message })
    }
  }

  async importData(req, res) {
    try {
      const result = await this.graphService.importData(req.params.id, req.body)
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '导入数据失败', error: error.message })
    }
  }

  async exportData(req, res) {
    try {
      const result = await this.graphService.exportData(req.params.id, req.query.format)
      if (result.success) {
        if (req.query.format === 'json') {
          res.json(result.data)
        } else {
          res.setHeader('Content-Type', 'text/xml')
          res.setHeader('Content-Disposition', `attachment; filename=graph_${req.params.id}.${req.query.format}`)
          res.send(result.data)
        }
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      res.status(500).json({ success: false, message: '导出数据失败', error: error.message })
    }
  }

  async searchNodes(req, res) {
    try {
      const result = await this.graphService.searchNodes(req.params.id, req.query.q, req.query)
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '搜索节点失败', error: error.message })
    }
  }

  async getNeighbors(req, res) {
    try {
      const result = await this.graphService.getNeighbors(
        req.params.id,
        req.params.nodeId,
        parseInt(req.query.depth) || 1
      )
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '获取邻居节点失败', error: error.message })
    }
  }

  async runAlgorithm(req, res) {
    try {
      const result = await this.graphService.runAlgorithm(
        req.params.id,
        req.params.algorithm,
        req.body
      )
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '运行算法失败', error: error.message })
    }
  }

  async findShortestPath(req, res) {
    try {
      const result = await this.graphService.findShortestPath(
        req.params.id,
        req.query.source,
        req.query.target
      )
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '查找最短路径失败', error: error.message })
    }
  }
}

const controller = new GraphController()
module.exports = {
  getGraphs: (req, res) => controller.getGraphs(req, res),
  getGraph: (req, res) => controller.getGraph(req, res),
  createGraph: (req, res) => controller.createGraph(req, res),
  updateGraph: (req, res) => controller.updateGraph(req, res),
  deleteGraph: (req, res) => controller.deleteGraph(req, res),
  importData: (req, res) => controller.importData(req, res),
  exportData: (req, res) => controller.exportData(req, res),
  searchNodes: (req, res) => controller.searchNodes(req, res),
  getNeighbors: (req, res) => controller.getNeighbors(req, res),
  runAlgorithm: (req, res) => controller.runAlgorithm(req, res),
  findShortestPath: (req, res) => controller.findShortestPath(req, res)
}
