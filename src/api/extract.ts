import { api } from './client';
import { ExtractRequest, ExtractResponse } from '../types';

export async function extractUrl(data: ExtractRequest): Promise<ExtractResponse> {
  const res = await api.post<ExtractResponse>('/extract', data);
  return res.data;
}
