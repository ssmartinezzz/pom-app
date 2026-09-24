import { api } from './client';
import { GenerateRequest, GenerateResponse } from '../types';

export async function generatePom(data: GenerateRequest): Promise<GenerateResponse> {
  const res = await api.post<GenerateResponse>('/generate', data);
  return res.data;
}
