import { create } from 'zustand';
import { ProjectSummary, Project, ExtractionSummary, Extraction, GenerationSummary, Generation, AnalysisSummary, Analysis, AuthStep, InjectCookie, ApiEndpoint, ApiEndpointSummary, CreateApiEndpointRequest, UpdateApiEndpointRequest, FolderSummary } from '../types';
import * as projectsApi from '../api/projects';
import * as extractionsApi from '../api/extractions';
import * as generationsApi from '../api/generations';
import * as extractApi from '../api/extract';
import * as generateApi from '../api/generate';
import * as analysesApi from '../api/analyses';
import * as analyzeApi from '../api/analyze';
import * as apiEndpointsApi from '../api/api-endpoints';
import { api } from '../api/client';

interface ProjectsState {
  projects: ProjectSummary[];
  isLoading: boolean;

  fetchProjects: () => Promise<void>;
  createProject: (data: Parameters<typeof projectsApi.createProject>[0]) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  getProject: (id: string) => Promise<Project>;
  fetchExtractions: (projectId: string, params?: { limit?: number; offset?: number; folder?: string }) => Promise<{ data: ExtractionSummary[]; total: number }>;
  getExtraction: (projectId: string, extractionId: string) => Promise<Extraction>;
  updateExtractionTitle: (projectId: string, extractionId: string, title: string) => Promise<void>;
  deleteExtraction: (projectId: string, extractionId: string) => Promise<void>;
  deleteElements: (projectId: string, extractionId: string, selectors: string[]) => Promise<number>;

  createFolder: (projectId: string, name: string) => Promise<void>;
  fetchFolders: (projectId: string) => Promise<FolderSummary[]>;
  updateExtractionFolder: (projectId: string, extractionId: string, folder: string | null) => Promise<void>;
  renameFolder: (projectId: string, oldName: string, newName: string) => Promise<void>;
  deleteFolder: (projectId: string, folderName: string) => Promise<void>;

  fetchGenerations: (projectId: string, params?: { limit?: number; offset?: number; folder?: string }) => Promise<{ data: GenerationSummary[]; total: number }>;
  getGeneration: (projectId: string, generationId: string) => Promise<Generation>;
  updateGenerationPageName: (projectId: string, generationId: string, pageName: string) => Promise<void>;
  updateGenerationFolder: (projectId: string, generationId: string, folder: string | null) => Promise<void>;
  deleteGeneration: (projectId: string, generationId: string) => Promise<void>;

  fetchAnalyses: (projectId: string, params?: { limit?: number; offset?: number }) => Promise<{ data: AnalysisSummary[]; total: number }>;
  getAnalysis: (projectId: string, analysisId: string) => Promise<Analysis>;
  deleteAnalysis: (projectId: string, analysisId: string) => Promise<void>;

  extractUrl: (url: string, projectId: string, authSteps?: AuthStep[], injectCookies?: InjectCookie[]) => Promise<{ extraction_id: string; warnings?: string[] }>;
  extractFromHtml: (html: string, url: string, projectId: string) => Promise<{ extraction_id: string; element_count: number }>;
  generatePom: (extractionId: string, projectId: string, languageId: string, pageName?: string) => Promise<string>;
  analyzePage: (extractionId: string, projectId: string) => Promise<string>;
  getDownloadZipUrl: (projectId: string) => string;

  fetchApiEndpoints: (projectId: string, params?: { limit?: number; offset?: number }) => Promise<{ data: ApiEndpointSummary[]; total: number }>;
  getApiEndpoint: (projectId: string, endpointId: string) => Promise<ApiEndpoint>;
  createApiEndpoint: (projectId: string, data: CreateApiEndpointRequest) => Promise<ApiEndpoint>;
  updateApiEndpoint: (projectId: string, endpointId: string, data: UpdateApiEndpointRequest) => Promise<void>;
  deleteApiEndpoint: (projectId: string, endpointId: string) => Promise<void>;

  getJobProgress: (projectId: string) => Promise<{
    status: string;
    started_at: number;
    current_page: number;
    total_pages: number;
    page_name: string;
    current_task: string;
  }>;
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  isLoading: false,

  fetchProjects: async () => {
    set({ isLoading: true });
    try {
      const projects = await projectsApi.listProjects();
      set({ projects, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  createProject: async (data) => {
    const project = await projectsApi.createProject(data);
    await get().fetchProjects();
    return project;
  },

  deleteProject: async (id) => {
    await projectsApi.deleteProject(id);
    set({ projects: get().projects.filter((p) => p.id !== id) });
  },

  getProject: async (id) => {
    return projectsApi.getProject(id);
  },

  fetchExtractions: async (projectId, params) => {
    const res = await extractionsApi.listExtractions(projectId, params);
    return { data: res.data, total: res.total };
  },

  getExtraction: async (projectId, extractionId) => {
    return extractionsApi.getExtraction(projectId, extractionId);
  },

  updateExtractionTitle: async (projectId, extractionId, title) => {
    await extractionsApi.patchExtraction(projectId, extractionId, { page_title: title });
  },

  deleteExtraction: async (projectId, extractionId) => {
    await extractionsApi.deleteExtraction(projectId, extractionId);
  },

  deleteElements: async (projectId, extractionId, selectors) => {
    const res = await extractionsApi.deleteElements(projectId, extractionId, selectors);
    return res.element_count;
  },

  createFolder: async (projectId, name) => {
    await extractionsApi.createFolder(projectId, name);
  },

  fetchFolders: async (projectId) => {
    return extractionsApi.listFolders(projectId);
  },

  updateExtractionFolder: async (projectId, extractionId, folder) => {
    await extractionsApi.updateExtractionFolder(projectId, extractionId, folder);
  },

  renameFolder: async (projectId, oldName, newName) => {
    await extractionsApi.renameFolder(projectId, oldName, newName);
  },

  deleteFolder: async (projectId, folderName) => {
    await extractionsApi.deleteFolder(projectId, folderName);
  },

  fetchGenerations: async (projectId, params) => {
    const res = await generationsApi.listGenerations(projectId, params);
    return { data: res.data, total: res.total };
  },

  getGeneration: async (projectId, generationId) => {
    return generationsApi.getGeneration(projectId, generationId);
  },

  updateGenerationPageName: async (projectId, generationId, pageName) => {
    await generationsApi.patchGeneration(projectId, generationId, { page_name: pageName });
  },

  updateGenerationFolder: async (projectId, generationId, folder) => {
    await generationsApi.updateGenerationFolder(projectId, generationId, folder);
  },

  deleteGeneration: async (projectId, generationId) => {
    await generationsApi.deleteGeneration(projectId, generationId);
  },

  extractUrl: async (url, projectId, authSteps, injectCookies) => {
    const hasCookies = injectCookies && injectCookies.length > 0;
    const res = await extractApi.extractUrl({
      url,
      project_id: projectId,
      pre_extraction_steps: authSteps,
      inject_cookies: hasCookies ? injectCookies : undefined,
      save_session: (authSteps && authSteps.length > 0) || hasCookies ? true : undefined,
    });
    return { extraction_id: res.extraction_id, warnings: res.warnings };
  },

  extractFromHtml: async (html, url, projectId) => {
    const { extractFromHTML } = await import('../utils/htmlExtractor');
    const { title, elements } = extractFromHTML(html);
    if (elements.length === 0) {
      throw new Error('No interactive elements found in the pasted HTML');
    }
    const res = await extractionsApi.saveManualExtraction(projectId, {
      url,
      page_title: title,
      elements_json: elements,
      element_count: elements.length,
    });
    return { extraction_id: res.id, element_count: elements.length };
  },

  generatePom: async (extractionId, projectId, languageId, pageName) => {
    const res = await generateApi.generatePom({
      extraction_id: extractionId,
      project_id: projectId,
      language_id: languageId,
      page_name: pageName,
    });
    return res.generation_id;
  },

  fetchAnalyses: async (projectId, params) => {
    const res = await analysesApi.listAnalyses(projectId, params);
    return { data: res.data, total: res.total };
  },

  getAnalysis: async (projectId, analysisId) => {
    return analysesApi.getAnalysis(projectId, analysisId);
  },

  deleteAnalysis: async (projectId, analysisId) => {
    await analysesApi.deleteAnalysis(projectId, analysisId);
  },

  analyzePage: async (extractionId, projectId) => {
    const res = await analyzeApi.analyze({
      extraction_id: extractionId,
      project_id: projectId,
    });
    return res.analysis_id;
  },

  getDownloadZipUrl: (projectId) => {
    const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:9080';
    return `${baseUrl}/api/v1/projects/${projectId}/zip`;
  },

  fetchApiEndpoints: async (projectId, params) => {
    const res = await apiEndpointsApi.listApiEndpoints(projectId, params);
    return { data: res.data, total: res.total };
  },

  getApiEndpoint: async (projectId, endpointId) => {
    return apiEndpointsApi.getApiEndpoint(projectId, endpointId);
  },

  createApiEndpoint: async (projectId, data) => {
    return apiEndpointsApi.createApiEndpoint(projectId, data);
  },

  updateApiEndpoint: async (projectId, endpointId, data) => {
    await apiEndpointsApi.updateApiEndpoint(projectId, endpointId, data);
  },

  deleteApiEndpoint: async (projectId, endpointId) => {
    await apiEndpointsApi.deleteApiEndpoint(projectId, endpointId);
  },

  getJobProgress: async (projectId) => {
    const { data } = await api.get(`/projects/${projectId}/ai-analyze/status`);
    return data;
  },
}));
