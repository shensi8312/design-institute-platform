// Fixed: Use shared axios instance with proper /api prefix
import axios from '../utils/axios';
import type { Organization, OrganizationFormData } from '../types';

// 获取组织列表
export const getOrganizations = async (): Promise<{list: Organization[], flatList: Organization[]}> => {
  const response = await axios.get('/api/organizations');
  if (response.data.success && response.data.data) {
    return response.data.data;
  }
  throw new Error('获取组织列表失败');
};

// 获取组织详情
export const getOrganization = async (id: string): Promise<Organization> => {
  const response = await axios.get(`/api/organizations/${id}`);
  if (response.data.success && response.data.data) {
    return response.data.data;
  }
  throw new Error('获取组织详情失败');
};

// 创建组织
export const createOrganization = async (data: OrganizationFormData): Promise<Organization> => {
  const response = await axios.post('/api/organizations', data);
  if (response.data.success && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.message || '创建组织失败');
};

// 更新组织
export const updateOrganization = async (id: string, data: Partial<OrganizationFormData>): Promise<Organization> => {
  const response = await axios.put(`/api/organizations/${id}`, data);
  if (response.data.success && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.message || '更新组织失败');
};

// 删除组织
export const deleteOrganization = async (id: string): Promise<void> => {
  try {
    const response = await axios.delete(`/api/organizations/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.message || '删除组织失败');
    }
  } catch (error: any) {
    // 提取后端返回的错误信息
    const message = error.response?.data?.message || error.message || '删除组织失败';
    throw new Error(message);
  }
};

// 获取组织的部门列表
export const getOrganizationDepartments = async (id: string): Promise<any[]> => {
  const response = await axios.get(`/api/organizations/${id}/departments`);
  if (response.data.success && response.data.data) {
    return response.data.data;
  }
  return [];
};

export const organizationAPI = {
  getOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  getOrganizationDepartments
};

export default organizationAPI;

export type { Organization, OrganizationFormData };
