import { api } from './client';
import { Generation, GenerationSummary, PaginatedResponse } from '../types';

export async function listGenerations(
  projectId: string,
  params?: { limit?: number; offset?: number; folder?: string }
): Promise<PaginatedResponse<GenerationSummary>> {
  const res = await api.get<PaginatedResponse<GenerationSummary>>(
    `/projects/${projectId}/generations`,
    { params }
  );
  return res.data;
}

export async function getGeneration(projectId: string, generationId: string): Promise<Generation> {
  const res = await api.get<Generation>(`/projects/${projectId}/generations/${generationId}`);
  return res.data;
}

export async function patchGeneration(
  projectId: string,
  generationId: string,
  data: { page_name: string }
): Promise<void> {
  await api.patch(`/projects/${projectId}/generations/${generationId}`, data);
}

export async function updateGenerationFolder(
  projectId: string,
  generationId: string,
  folder: string | null
): Promise<void> {
  await api.patch(`/projects/${projectId}/generations/${generationId}/folder`, { folder });
}

export async function deleteGeneration(projectId: string, generationId: string): Promise<void> {
  await api.delete(`/projects/${projectId}/generations/${generationId}`);
}
