// 组织相关类型
export interface Organization {
  id: string;
  name: string;
  code?: string;
  type?: 'company' | 'branch' | 'department';
  parentId?: string | null;
  parent_id?: string | null;
  description?: string;
  address?: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  status?: 'active' | 'inactive';
  sort_order?: number;
  memberCount?: number;
  department_count?: number;
  user_count?: number;
  createdAt?: string;
  updatedAt?: string;
  created_at?: string;
  updated_at?: string;
  created_time?: string;
  updated_time?: string;
  children?: Organization[];
}

export interface OrganizationFormData {
  name: string;
  code?: string;
  type?: 'company' | 'branch' | 'department';
  parent_id?: string | null;
  description?: string;
  address?: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  status: 'active' | 'inactive';
}

// 角色相关类型
export interface Role {
  id: number;
  name: string;
  code?: string;
  display_name: string;
  description?: string;
  permissions: string[];
  userCount?: number;
  createdAt?: string;
}

// 用户相关类型
export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  phone?: string;
  department_id?: string;
  organization_id?: string;
  roles?: Role[];
  status: 'active' | 'inactive';
}

export interface Permission {
  id: number;
  name: string;
  code: string;
  module: string;
  action: string;
  description?: string;
  groupName?: string;
  resource?: string;
  isSystem: boolean;
  createdTime?: string;
  updatedTime?: string;
  roles?: Role[];
}

export interface Menu {
  id: string;
  name: string;
  path: string;
  icon?: string;
  parentId?: string;
  children?: Menu[];
  permission?: string;
}
