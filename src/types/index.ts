// Auth
export interface User {
  id: string;
  email: string;
  username: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

// Projects
export type ProjectType = 'web' | 'api';
export type BrowserType = 'chromium' | 'firefox' | 'webkit';

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string;
  base_url: string;
  language_id: string;
  project_type: ProjectType;
  browser: BrowserType;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  base_url: string;
  language_id: string;
  project_type: ProjectType;
  browser: BrowserType;
  status: string;
  created_at: string;
  extraction_count: number;
  generation_count: number;
  endpoint_count: number;
}

export interface CreateProjectRequest {
  name: string;
  description: string;
  base_url: string;
  language_id: string;
  project_type?: ProjectType;
  browser?: BrowserType;
}

// API Endpoints
export interface ApiEndpoint {
  id: string;
  project_id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  headers: Record<string, string>;
  request_body: string;
  expected_status: number;
  description: string;
  sort_order: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ApiEndpointSummary {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  expected_status: number;
  description: string;
  sort_order: number;
  status: string;
  created_at: string;
}

export interface CreateApiEndpointRequest {
  name: string;
  method: string;
  path: string;
  headers?: Record<string, string>;
  request_body?: string;
  expected_status?: number;
  description?: string;
}

export interface UpdateApiEndpointRequest {
  name?: string;
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  request_body?: string;
  expected_status?: number;
  description?: string;
}

// Extractions
export interface PageElement {
  tag: string;
  type?: string;
  id?: string;
  name?: string;
  class?: string;
  placeholder?: string;
  text?: string;
  href?: string;
  selector: string;
}

export interface Extraction {
  id: string;
  project_id: string;
  url: string;
  page_title: string;
  elements_json: PageElement[];
  element_count: number;
  pre_steps?: AuthStep[] | null;
  folder?: string | null;
  status: string;
  created_at: string;
}

export interface ExtractionSummary {
  id: string;
  url: string;
  page_title: string;
  element_count: number;
  folder?: string | null;
  status: string;
  created_at: string;
}

export interface AuthStep {
  action: 'navigate' | 'fill' | 'click' | 'wait' | 'select';
  url?: string;
  selector?: string;
  value?: string;
  for?: string;
  timeout?: number;
}

export interface InjectCookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface ExtractRequest {
  url: string;
  project_id: string;
  wait_for?: string;
  pre_extraction_steps?: AuthStep[];
  inject_cookies?: InjectCookie[];
  save_session?: boolean;
}

export interface ExtractResponse {
  extraction_id: string;
  url: string;
  final_url?: string;
  title: string;
  element_count: number;
  elements: PageElement[];
  warnings?: string[];
}

// Generations
export interface Generation {
  id: string;
  extraction_id: string;
  project_id: string;
  page_name: string;
  page_code: string;
  test_code: string;
  language_id: string;
  llm_model: string;
  tokens_used: number;
  folder?: string | null;
  status: string;
  created_at: string;
}

export interface GenerationSummary {
  id: string;
  extraction_id: string;
  page_name: string;
  language_id: string;
  llm_model: string;
  tokens_used: number;
  folder?: string | null;
  status: string;
  created_at: string;
}

export interface FolderSummary {
  folder: string;
  extraction_count: number;
}

export interface GenerateRequest {
  extraction_id: string;
  project_id: string;
  language_id: string;
  page_name?: string;
}

export interface GenerateResponse {
  generation_id: string;
  page_name: string;
  page_code: string;
  test_code: string;
  language: string;
  tokens_used: number;
  llm_model: string;
}

// Analyses
export interface Analysis {
  id: string;
  extraction_id: string;
  project_id: string;
  page_type: string;
  page_name: string;
  summary: string;
  test_strategy: {
    smoke_tests: string[];
    functional_tests: string[];
    edge_cases: string[];
    negative_tests: string[];
    accessibility_tests: string[];
  };
  selector_analysis: {
    current_selector: string;
    resilience: string;
    suggestion: string;
    reason: string;
  }[];
  assertions: {
    element: string;
    assertion: string;
    type: string;
  }[];
  gherkin: string;
  llm_model: string;
  tokens_used: number;
  status: string;
  created_at: string;
}

export interface AnalysisSummary {
  id: string;
  extraction_id: string;
  page_type: string;
  page_name: string;
  summary: string;
  llm_model: string;
  tokens_used: number;
  status: string;
  created_at: string;
  applied_at: string | null;
}

export interface AnalyzeRequest {
  extraction_id: string;
  project_id: string;
}

export interface AnalyzeResponse {
  analysis_id: string;
  page_type: string;
  summary: string;
  test_strategy: Analysis['test_strategy'];
  selector_analysis: Analysis['selector_analysis'];
  assertions: Analysis['assertions'];
  gherkin: string;
  llm_model: string;
  tokens_used: number;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// Languages
export interface Language {
  id: string;
  name: string;
  display: string;
  framework: string;
}

export interface Template {
  id: string;
  template_type: string;
  name: string;
  content: string;
  filename_template: string;
  directory_path: string;
}
