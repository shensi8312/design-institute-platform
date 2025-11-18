import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Spin } from 'antd';

// 布局组件
const Dashboard = lazy(() => import('../layouts/Dashboard'));
const Login = lazy(() => import('../pages/Login'));

// 懒加载页面组件
const Home = lazy(() => import('../pages/Home'));
const UserManagement = lazy(() => import('../pages/UserManagement'));
const RoleManagement = lazy(() => import('../pages/RoleManagement'));
const DepartmentManagement = lazy(() => import('../pages/DepartmentManagement'));
const OrganizationManagement = lazy(() => import('../pages/OrganizationManagement'));
const ProjectManagement = lazy(() => import('../pages/ProjectManagement'));
const MenuManagement = lazy(() => import('../pages/MenuManagement'));
const PermissionManagement = lazy(() => import('../pages/PermissionManagement'));
const SystemConfig = lazy(() => import('../pages/SystemConfig'));
const SystemLogs = lazy(() => import('../pages/SystemLogs'));
const ServiceMonitor = lazy(() => import('../pages/ServiceMonitor'));
const MyTasks = lazy(() => import('../pages/MyTasks'));

// 数字工地
const DigitalSiteOverview = lazy(() => import('../pages/DigitalSite/DigitalSiteOverview'));
const DigitalSiteAlerts = lazy(() => import('../pages/DigitalSite/DigitalSiteAlerts'));

// 统一文档系统
const DocumentManagement = lazy(() => import('../pages/DocumentManagement'));
const DocumentEditor = lazy(() => import('../pages/DocumentEditor'));
const TemplateManagement = lazy(() => import('../pages/TemplateManagement'));
const TemplateViewer = lazy(() => import('../pages/TemplateViewer'));
const TemplateEditor = lazy(() => import('../pages/TemplateEditor'));
const ApprovalTasks = lazy(() => import('../pages/ApprovalTasks'));
const ArchiveManagement = lazy(() => import('../pages/ArchiveManagement'));

// 知识管理 - 新整合的页面
const EnterpriseKnowledge = lazy(() => import('../pages/EnterpriseKnowledge'));
const PersonalKnowledge = lazy(() => import('../pages/PersonalKnowledge'));
const IntelligentQA = lazy(() => import('../pages/IntelligentQA'));
const ContentReview = lazy(() => import('../pages/ContentReview'));
const KnowledgeGraph = lazy(() => import('../pages/KnowledgeGraph'));

// 图谱管理相关页面
const GraphConfig = lazy(() => import('../pages/GraphConfig'));
const GraphAnnotation = lazy(() => import('../pages/GraphAnnotation'));

// 旧页面保留用于兼容
const KnowledgeManage = lazy(() => import('../pages/KnowledgeManage'));
const KnowledgeUpload = lazy(() => import('../pages/KnowledgeUpload'));
const KnowledgeBatchUpload = lazy(() => import('../pages/KnowledgeBatchUpload'));
const KnowledgeSearch = lazy(() => import('../pages/KnowledgeSearch'));
const KnowledgeChat = lazy(() => import('../pages/KnowledgeChat'));
const MyDocuments = lazy(() => import('../pages/MyDocuments'));
const HumanReview = lazy(() => import('../pages/HumanReview'));

// 工作流
const WorkflowEditor = lazy(() => import('../pages/WorkflowEditor'));
const AgentWorkflow = lazy(() => import('../pages/AgentWorkflow/WorkflowDesigner'));

// 新增页面
const LangExtract = lazy(() => import('../pages/LangExtract'));
const EngineManagement = lazy(() => import('../pages/EngineManagement'));
const BuildingLayoutEngine = lazy(() => import('../pages/BuildingLayoutEngine'));
const AssemblyConstraintEngine = lazy(() => import('../pages/AssemblyConstraintEngine'));
const AssemblyRuleManagement = lazy(() => import('../pages/AssemblyRuleManagement'));
const AssemblyTaskList = lazy(() => import('../pages/AssemblyTaskList'));
const AssemblyDesignManagement = lazy(() => import('../pages/AssemblyDesignManagement'));
const AssemblyValidationExport = lazy(() => import('../pages/AssemblyValidationExport'));
const AssemblyVisualization3D = lazy(() => import('../pages/AssemblyVisualization3D'));
const PIDRecognition = lazy(() => import('../pages/PIDRecognition'));
const DrawingComparison = lazy(() => import('../pages/DrawingComparison'));
const SketchRecognition = lazy(() => import('../pages/SketchRecognition'));
const ModelTraining = lazy(() => import('../pages/ModelTraining'));
const DebugMenu = lazy(() => import('../pages/DebugMenu'));
const RuleReview = lazy(() => import('../pages/RuleReview'));
const DocumentPreview = lazy(() => import('../pages/DocumentPreview'));
const UnifiedRuleManagement = lazy(() => import('../pages/UnifiedRuleManagement'));
const RuleLearningConfig = lazy(() => import('../pages/RuleLearningConfig'));

// V3.0 项目工作台
const ProjectWorkspace = lazy(() => import('../pages/ProjectWorkspace'));

// 加载组件
const PageLoading = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh'
  }}>
    <Spin size="large" tip="加载中..." />
  </div>
);

// 懒加载包装器
const LazyWrapper = ({ Component }: { Component: React.LazyExoticComponent<any> }) => (
  <Suspense fallback={<PageLoading />}>
    <Component />
  </Suspense>
);

// 路由守卫
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

// 路由配置
const router = createBrowserRouter([
  {
    path: '/login',
    element: <LazyWrapper Component={Login} />
  },
  {
    path: '/preview/:id',
    element: (
      <ProtectedRoute>
        <LazyWrapper Component={DocumentPreview} />
      </ProtectedRoute>
    )
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <LazyWrapper Component={Dashboard} />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <LazyWrapper Component={Home} />
      },
      // 统一文档系统
      {
        path: 'documents',
        element: <LazyWrapper Component={DocumentManagement} />
      },
      {
        path: 'documents/:id/edit',
        element: <LazyWrapper Component={DocumentEditor} />
      },
      {
        path: 'documents/:id/view',
        element: <LazyWrapper Component={DocumentEditor} />
      },
      {
        path: 'templates',
        element: <LazyWrapper Component={TemplateManagement} />
      },
      {
        path: 'templates/:id/view',
        element: <LazyWrapper Component={TemplateViewer} />
      },
      {
        path: 'templates/:id/edit',
        element: <LazyWrapper Component={TemplateEditor} />
      },
      {
        path: 'approval-tasks',
        element: <LazyWrapper Component={ApprovalTasks} />
      },
      {
        path: 'archive-management',
        element: <LazyWrapper Component={ArchiveManagement} />
      },
      // 数字工地
      {
        path: 'digital-site',
        children: [
          {
            index: true,
            element: <LazyWrapper Component={DigitalSiteOverview} />
          },
          {
            path: 'overview',
            element: <LazyWrapper Component={DigitalSiteOverview} />
          },
          {
            path: 'alerts',
            element: <LazyWrapper Component={DigitalSiteAlerts} />
          }
        ]
      },
      // 系统管理
      {
        path: 'system',
        children: [
          {
            path: 'users',
            element: <LazyWrapper Component={UserManagement} />
          },
          {
            path: 'roles',
            element: <LazyWrapper Component={RoleManagement} />
          },
          {
            path: 'departments',
            element: <LazyWrapper Component={DepartmentManagement} />
          },
          {
            path: 'organizations',
            element: <LazyWrapper Component={OrganizationManagement} />
          },
          {
            path: 'menus',
            element: <LazyWrapper Component={MenuManagement} />
          },
          {
            path: 'permissions',
            element: <LazyWrapper Component={PermissionManagement} />
          },
          {
            path: 'config',
            element: <LazyWrapper Component={SystemConfig} />
          },
          {
            path: 'logs',
            element: <LazyWrapper Component={SystemLogs} />
          },
          {
            path: 'monitor',
            element: <LazyWrapper Component={ServiceMonitor} />
          }
        ]
      },
      // 项目管理
      {
        path: 'projects',
        element: <LazyWrapper Component={ProjectManagement} />
      },
      {
        path: 'projects/all',
        element: <LazyWrapper Component={ProjectManagement} />
      },
      {
        path: 'projects/create',
        element: <LazyWrapper Component={ProjectManagement} />
      },
      {
        path: 'projects/assign',
        element: <LazyWrapper Component={ProjectManagement} />
      },
      {
        path: 'projects/:projectId',
        element: <LazyWrapper Component={ProjectWorkspace} />
      },
      // 知识管理 - 新整合的路由
      {
        path: 'knowledge',
        children: [
          // 新页面
          {
            path: 'enterprise',
            element: <LazyWrapper Component={EnterpriseKnowledge} />
          },
          {
            path: 'personal',
            element: <LazyWrapper Component={PersonalKnowledge} />
          },
          {
            path: 'qa',
            element: <LazyWrapper Component={IntelligentQA} />
          },
          {
            path: 'graph',
            element: <LazyWrapper Component={KnowledgeGraph} />
          },
          {
            path: 'graph-config',
            element: <LazyWrapper Component={GraphConfig} />
          },
          {
            path: 'graph-annotation',
            element: <LazyWrapper Component={GraphAnnotation} />
          },
          {
            path: 'review',
            element: <LazyWrapper Component={ContentReview} />
          },
          // 旧路由保留用于兼容
          {
            path: 'manage',
            element: <LazyWrapper Component={KnowledgeManage} />
          },
          {
            path: 'upload',
            element: <LazyWrapper Component={KnowledgeUpload} />
          },
          {
            path: 'batch-upload',
            element: <LazyWrapper Component={KnowledgeBatchUpload} />
          },
          {
            path: 'search',
            element: <LazyWrapper Component={KnowledgeSearch} />
          },
          {
            path: 'chat',
            element: <LazyWrapper Component={KnowledgeChat} />
          },
          {
            path: 'my-documents',
            element: <LazyWrapper Component={MyDocuments} />
          },
          {
            path: 'documents',
            element: <LazyWrapper Component={MyDocuments} />
          },
          {
            path: 'human-review',
            element: <LazyWrapper Component={HumanReview} />
          }
        ]
      },
      // 工作流 - 我的任务
      {
        path: 'workflow',
        element: <LazyWrapper Component={MyTasks} />
      },
      {
        path: 'workflow/editor',
        element: <LazyWrapper Component={WorkflowEditor} />
      },
      {
        path: 'workflow/agent',
        element: <LazyWrapper Component={AgentWorkflow} />
      },
      // 节点管理
      {
        path: 'engines',
        element: <LazyWrapper Component={EngineManagement} />
      },
      {
        path: 'engines/building-layout',
        element: <LazyWrapper Component={BuildingLayoutEngine} />
      },
      {
        path: 'mechanical-design/pid-recognition',
        element: <LazyWrapper Component={PIDRecognition} />
      },
      {
        path: 'mechanical-design/drawing-comparison',
        element: <LazyWrapper Component={DrawingComparison} />
      },
      {
        path: 'mechanical-design/assembly-constraint',
        element: <LazyWrapper Component={AssemblyConstraintEngine} />
      },
      {
        path: 'mechanical-design/assembly-rules',
        element: <LazyWrapper Component={AssemblyRuleManagement} />
      },
      {
        path: 'mechanical-design/assembly-tasks',
        element: <LazyWrapper Component={AssemblyTaskList} />
      },
      {
        path: 'mechanical-design/assembly-visualization/:taskId',
        element: <LazyWrapper Component={AssemblyVisualization3D} />
      },
      {
        path: 'mechanical-design/assembly-designs',
        element: <LazyWrapper Component={AssemblyDesignManagement} />
      },
      {
        path: 'mechanical-design/validation-export',
        element: <LazyWrapper Component={AssemblyValidationExport} />
      },
      // 学习与标注
      {
        path: 'langextract',
        element: <LazyWrapper Component={LangExtract} />
      },
      {
        path: 'sketch-recognition',
        element: <LazyWrapper Component={SketchRecognition} />
      },
      {
        path: 'training',
        element: <LazyWrapper Component={ModelTraining} />
      },
      // 调试页面
      {
        path: 'debug-menu',
        element: <LazyWrapper Component={DebugMenu} />
      },
      // 规则审核
      {
        path: 'rules/review',
        element: <LazyWrapper Component={RuleReview} />
      },
      {
        path: 'rules/unified-management',
        element: <LazyWrapper Component={UnifiedRuleManagement} />
      },
      {
        path: 'rules/learning-config',
        element: <LazyWrapper Component={RuleLearningConfig} />
      }
    ]
  },
  {
    path: '*',
    element: <Navigate to="/" replace />
  }
]);

export default router;
