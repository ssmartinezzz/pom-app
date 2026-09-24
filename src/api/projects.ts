import { api } from './client';
import { CreateProjectRequest, Project, ProjectSummary } from '../types';

export async function listProjects(): Promise<ProjectSummary[]> {
  const res = await api.get<ProjectSummary[]>('/projects');
  return res.data;
}

export async function getProject(id: string): Promise<Project> {
  const res = await api.get<Project>(`/projects/${id}`);
  return res.data;
}

export async function createProject(data: CreateProjectRequest): Promise<Project> {
  const res = await api.post<Project>('/projects', data);
  return res.data;
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`);
}
