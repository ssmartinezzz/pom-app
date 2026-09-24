import { api } from './client';
import { AnalysisSummary, Analysis, PaginatedResponse } from '../types';

export async function listAnalyses(
  projectId: string,
  params?: { limit?: number; offset?: number }
): Promise<PaginatedResponse<AnalysisSummary>> {
  const res = await api.get<PaginatedResponse<AnalysisSummary>>(
    `/projects/${projectId}/analyses`,
    { params }
  );
  return res.data;
}

export async function getAnalysis(projectId: string, analysisId: string): Promise<Analysis> {
  const res = await api.get<Analysis>(`/projects/${projectId}/analyses/${analysisId}`);
  return res.data;
}

export async function deleteAnalysis(projectId: string, analysisId: string): Promise<void> {
  await api.delete(`/projects/${projectId}/analyses/${analysisId}`);
}
