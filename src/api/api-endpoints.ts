import { api } from './client';
import {
  ApiEndpoint,
  ApiEndpointSummary,
  CreateApiEndpointRequest,
  UpdateApiEndpointRequest,
  PaginatedResponse,
} from '../types';

export async function listApiEndpoints(
  projectId: string,
  params?: { limit?: number; offset?: number }
): Promise<PaginatedResponse<ApiEndpointSummary>> {
  const res = await api.get<PaginatedResponse<ApiEndpointSummary>>(
    `/projects/${projectId}/api-endpoints`,
    { params }
  );
  return res.data;
}

export async function getApiEndpoint(
  projectId: string,
  endpointId: string
): Promise<ApiEndpoint> {
  const res = await api.get<ApiEndpoint>(
    `/projects/${projectId}/api-endpoints/${endpointId}`
  );
  return res.data;
}

export async function createApiEndpoint(
  projectId: string,
  data: CreateApiEndpointRequest
): Promise<ApiEndpoint> {
  const res = await api.post<ApiEndpoint>(
    `/projects/${projectId}/api-endpoints`,
    data
  );
  return res.data;
}

export async function updateApiEndpoint(
  projectId: string,
  endpointId: string,
  data: UpdateApiEndpointRequest
): Promise<void> {
  await api.put(`/projects/${projectId}/api-endpoints/${endpointId}`, data);
}

export async function deleteApiEndpoint(
  projectId: string,
  endpointId: string
): Promise<void> {
  await api.delete(`/projects/${projectId}/api-endpoints/${endpointId}`);
}
