module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'script'
  },
  ignorePatterns: [
    'coverage/',
    'dist/',
    'logs/',
    'tests/',
    'knexfile.js',
    'src/coverage/**',
    'src/ai-*/**',
    'src/core/**',
    'src/engines/**',
    'src/migrations/**',
    'src/services/ai-modeling/**',
    'src/services/knowledge/**',
    'src/services/utils/**',
    'src/services/workflow/**',
    'src/services/auth/**',
    'src/workflows/**',
    'src/routes/ai-modeling.js',
    'src/routes/cv-vl-fusion.js',
    'src/routes/ai-plugin.js',
    'src/routes/knowledge.js',
    'src/routes/nodes.js',
    'src/routes/vision.js',
    'src/routes/workflowTemplate.js',
    'src/repositories/**',
    'src/services/document/**',
    'src/controllers/AIPluginController.js',
    'src/controllers/AnnotationController.js',
    'src/controllers/ChatController.js',
    'src/controllers/GraphLearningController.js',
    'src/controllers/KnowledgeBatchController.js',
    'src/controllers/SpatialController.js'
  ],
  rules: {
    'no-console': 'off',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
  }
}
