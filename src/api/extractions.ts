import { api } from './client';
import { Extraction, ExtractionSummary, FolderSummary, PageElement, PaginatedResponse } from '../types';

export async function listExtractions(
  projectId: string,
  params?: { limit?: number; offset?: number; folder?: string }
): Promise<PaginatedResponse<ExtractionSummary>> {
  const res = await api.get<PaginatedResponse<ExtractionSummary>>(
    `/projects/${projectId}/extractions`,
    { params }
  );
  return res.data;
}

export async function listFolders(projectId: string): Promise<FolderSummary[]> {
  const res = await api.get<FolderSummary[]>(`/projects/${projectId}/folders`);
  return res.data;
}

export async function createFolder(projectId: string, name: string): Promise<void> {
  await api.post(`/projects/${projectId}/folders`, { name });
}

export async function updateExtractionFolder(
  projectId: string,
  extractionId: string,
  folder: string | null
): Promise<void> {
  await api.patch(`/projects/${projectId}/extractions/${extractionId}/folder`, { folder });
}

export async function renameFolder(
  projectId: string,
  oldName: string,
  newName: string
): Promise<void> {
  await api.patch(`/projects/${projectId}/folders/${oldName}`, { new_name: newName });
}

export async function deleteFolder(projectId: string, folderName: string): Promise<void> {
  await api.delete(`/projects/${projectId}/folders/${folderName}`);
}

export async function getExtraction(projectId: string, extractionId: string): Promise<Extraction> {
  const res = await api.get<Extraction>(`/projects/${projectId}/extractions/${extractionId}`);
  return res.data;
}

export async function patchExtraction(
  projectId: string,
  extractionId: string,
  data: { page_title: string }
): Promise<void> {
  await api.patch(`/projects/${projectId}/extractions/${extractionId}`, data);
}

export async function deleteExtraction(projectId: string, extractionId: string): Promise<void> {
  await api.delete(`/projects/${projectId}/extractions/${extractionId}`);
}

export async function saveManualExtraction(
  projectId: string,
  data: { url: string; page_title: string; elements_json: PageElement[]; element_count: number }
): Promise<ExtractionSummary> {
  const res = await api.post<ExtractionSummary>(
    `/projects/${projectId}/extractions`,
    data
  );
  return res.data;
}

export async function deleteElements(
  projectId: string,
  extractionId: string,
  selectors: string[]
): Promise<{ element_count: number }> {
  const res = await api.delete<{ message: string; element_count: number }>(
    `/projects/${projectId}/extractions/${extractionId}/elements`,
    { data: { selectors } }
  );
  return res.data;
}
