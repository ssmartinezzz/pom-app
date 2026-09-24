import { api } from './client';
import { AnalyzeRequest, AnalyzeResponse } from '../types';

export async function analyze(data: AnalyzeRequest): Promise<AnalyzeResponse> {
  const res = await api.post<AnalyzeResponse>('/analyze', data);
  return res.data;
}
