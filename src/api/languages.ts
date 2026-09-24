import { api } from './client';
import { Language, Template } from '../types';

export async function listLanguages(): Promise<Language[]> {
  const res = await api.get<Language[]>('/languages');
  return res.data;
}

export async function getLanguageTemplates(languageId: string): Promise<Template[]> {
  const res = await api.get<Template[]>(`/languages/${languageId}/templates`);
  return res.data;
}
