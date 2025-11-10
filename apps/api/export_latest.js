const db = require('./src/config/database')
db('assembly_inference_tasks').orderBy('created_at', 'desc').first()
  .then(t => { console.log(t.id); db.destroy() })
  .catch(e => { console.error(e.message); process.exit(1) })
