import { apiClient } from './client';
import { mapDeveloperProject } from './mappers';

import type {
  ApiDeveloperProject,
  ApiListResponse,
  DeveloperProject,
  DeveloperProjectStatus,
  Language,
  PriceQualifier
} from '../types';

type DeveloperProjectParams = {
  developerId?: string;
  status?: DeveloperProjectStatus;
  take?: number;
  skip?: number;
};

export type CreateDeveloperProjectPayload = {
  nameEn: string;
  nameAr?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  locationEn: string;
  locationAr?: string;
  completionStatus?: string;
  handoverDate?: string;
  totalUnits?: number;
  availableUnits?: number;
  bedroomsSummary?: string;
  amenities?: string[];
  paymentPlan?: string;
  brochureUrl?: string;
  masterplanUrl?: string;
  videoWalkthroughUrl?: string;
  image?: string;
  images?: Array<{
    url: string;
    altEn?: string;
    altAr?: string;
    sortOrder?: number;
  }>;
  startingPriceAmount?: string | number;
  priceCurrency?: string;
  priceQualifier?: PriceQualifier;
  developerId?: string;
  developerNameEn?: string;
  developerNameAr?: string;
  nearestLandmarkId?: string;
};

export async function getDeveloperProjects(
  language: Language,
  params?: DeveloperProjectParams
): Promise<DeveloperProject[]> {
  const response = await apiClient.get<ApiListResponse<ApiDeveloperProject, 'projects'>>(
    '/api/developers/projects',
    { params }
  );

  return response.projects.map((project) => mapDeveloperProject(project, language));
}

export async function getMyDeveloperProjects(
  token: string,
  language: Language,
  params?: DeveloperProjectParams
): Promise<DeveloperProject[]> {
  const response = await apiClient.get<ApiListResponse<ApiDeveloperProject, 'projects'>>(
    '/api/developers/projects/mine',
    { token, params }
  );

  return response.projects.map((project) => mapDeveloperProject(project, language));
}

export async function getDeveloperProjectBySlug(
  slug: string,
  language: Language
): Promise<DeveloperProject> {
  const response = await apiClient.get<{ project: ApiDeveloperProject }>(
    "/api/developers/projects/" + slug
  );

  return mapDeveloperProject(response.project, language);
}

export async function getProjectsByDeveloperSlug(
  developerSlug: string,
  language: Language,
  params?: DeveloperProjectParams
): Promise<DeveloperProject[]> {
  const response = await apiClient.get<ApiListResponse<ApiDeveloperProject, 'projects'>>(
    "/api/developers/" + developerSlug + "/projects",
    { params }
  );

  return response.projects.map((project) => mapDeveloperProject(project, language));
}

export async function createDeveloperProject(
  payload: CreateDeveloperProjectPayload,
  token: string,
  language: Language
): Promise<DeveloperProject> {
  const response = await apiClient.post<{ project: ApiDeveloperProject }>(
    '/api/developers/projects',
    payload,
    { token }
  );

  return mapDeveloperProject(response.project, language);
}
