import {
  Building2,
  Filter,
  MapPin,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { getDeveloperProjects } from '../api/developerProjects';
import { getDevelopers } from '../api/marketplace';
import { ProjectCard } from '../components/Cards';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useLanguage } from '../i18n/LanguageContext';
import type { DeveloperProject, DevelopmentCompany } from '../types';

const projectStatusFilters = ['All', 'Ready now', 'Under construction', 'Off-plan'] as const;
const PROJECTS_PAGE_SIZE = 12;

type ProjectStatusFilter = (typeof projectStatusFilters)[number];

function getFilterParam<T extends readonly string[]>(
  value: string | null,
  options: T,
  fallback: T[number]
) {
  return value && options.includes(value as T[number]) ? (value as T[number]) : fallback;
}

function getBooleanParam(value: string | null) {
  return value === 'true' || value === '1';
}

function getProjectStatusMatch(project: DeveloperProject, filter: ProjectStatusFilter) {
  if (filter === 'All') return true;

  const normalized = `${project.completionStatus ?? ''} ${project.description ?? ''}`.toLowerCase();

  if (filter === 'Ready now') {
    return /ready|complete|completed|delivered|handover|move/i.test(normalized);
  }

  if (filter === 'Under construction') {
    return /construction|building|progress|under/i.test(normalized);
  }

  return /off.plan|off-plan|launch|planned|future/i.test(normalized);
}

function projectMatchesSearch(project: DeveloperProject, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return true;

  return [
    project.name,
    project.description,
    project.location,
    project.completionStatus,
    project.bedroomsSummary,
    project.developer?.name,
    project.nearestLandmarkName,
    ...project.amenities
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function projectMatchesLocation(project: DeveloperProject, location: string) {
  const normalizedLocation = location.trim().toLowerCase();

  if (!normalizedLocation) return true;

  return [project.location, project.nearestLandmarkName]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedLocation));
}

export default function Projects() {
  const { language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  useDocumentTitle(language === 'ar' ? 'المشاريع' : 'Projects');

  const [projects, setProjects] = useState<DeveloperProject[]>([]);
  const [developers, setDevelopers] = useState<DevelopmentCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);

  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [location, setLocation] = useState(searchParams.get('location') ?? '');
  const [developerSlug, setDeveloperSlug] = useState(searchParams.get('developer') ?? '');
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>(
    getFilterParam(searchParams.get('status'), projectStatusFilters, 'All')
  );
  const [verifiedOnly, setVerifiedOnly] = useState(getBooleanParam(searchParams.get('verifiedOnly')));

  const debouncedQuery = useDebouncedValue(query);
  const debouncedLocation = useDebouncedValue(location);

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'مشاريع عقارية',
          title: 'استكشف المشاريع والتطويرات في عُمان',
          description:
            'مشاريع منشورة من مطورين عقاريين، مع معلومات الوحدات، الوسائط، المستندات، وروابط التفاصيل.',
          filters: 'تصفية المشاريع',
          search: 'ابحثي بالاسم، الموقع، المطور، أو المرافق',
          location: 'الموقع',
          allDevelopers: 'كل المطورين',
          developer: 'المطور',
          status: 'مرحلة المشروع',
          verifiedOnly: 'مطورون موثقون فقط',
          reset: 'إعادة التصفية',
          activeFilters: 'الفلاتر النشطة',
          loading: 'جاري تحميل المشاريع...',
          error: 'تعذر تحميل المشاريع. تأكدي أن الخادم يعمل ثم حاولي مرة أخرى.',
          emptyTitle: 'لا توجد مشاريع مطابقة حالياً',
          emptyText: 'جرّبي تعديل البحث أو إزالة بعض الفلاتر.',
          showing: 'يتم عرض',
          result: 'مشروع',
          trust: 'تُعرض هنا المشاريع المعتمدة فقط بعد مراجعة أساسية للبيانات والوسائط وربط المطور.',
          clear: 'مسح'
        }
      : {
          eyebrow: 'Development projects',
          title: 'Explore projects and developments across Oman',
          description:
            'Published developer projects with unit inventory, media, documents, and clear detail paths.',
          filters: 'Filter projects',
          search: 'Search by name, location, developer, or amenities',
          location: 'Location',
          allDevelopers: 'All developers',
          developer: 'Developer',
          status: 'Project stage',
          verifiedOnly: 'Verified developers only',
          reset: 'Reset filters',
          activeFilters: 'Active filters',
          loading: 'Loading projects...',
          error: 'Could not load projects. Make sure the backend is running and try again.',
          emptyTitle: 'No matching projects right now',
          emptyText: 'Try adjusting the search or removing some filters.',
          showing: 'Showing',
          result: 'project',
          trust: 'Only approved projects appear here after baseline review of data, media, and developer linkage.',
          clear: 'Clear'
        };

  useEffect(() => {
    let isMounted = true;

    async function loadProjects() {
      try {
        setLoading(true);
        setLoadError('');

        const [apiProjects, apiDevelopers] = await Promise.all([
          getDeveloperProjects(language, { take: 100 }),
          getDevelopers(language, { take: 100 })
        ]);

        if (!isMounted) return;

        setProjects(apiProjects);
        setDevelopers(apiDevelopers);
      } catch (error) {
        console.error(error);
        if (isMounted) setLoadError(copy.error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadProjects();

    return () => {
      isMounted = false;
    };
  }, [copy.error, language]);

  useEffect(() => {
    const params = new URLSearchParams();

    if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim());
    if (debouncedLocation.trim()) params.set('location', debouncedLocation.trim());
    if (developerSlug) params.set('developer', developerSlug);
    if (statusFilter !== 'All') params.set('status', statusFilter);
    if (verifiedOnly) params.set('verifiedOnly', 'true');

    setSearchParams(params, { replace: true });
    setPage(1);
  }, [debouncedLocation, debouncedQuery, developerSlug, setSearchParams, statusFilter, verifiedOnly]);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      if (!projectMatchesSearch(project, debouncedQuery)) return false;
      if (!projectMatchesLocation(project, debouncedLocation)) return false;
      if (developerSlug && project.developer?.slug !== developerSlug) return false;
      if (verifiedOnly && !project.developer?.verified) return false;
      if (!getProjectStatusMatch(project, statusFilter)) return false;

      return true;
    });
  }, [debouncedLocation, debouncedQuery, developerSlug, projects, statusFilter, verifiedOnly]);

  const pageCount = Math.max(1, Math.ceil(filteredProjects.length / PROJECTS_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * PROJECTS_PAGE_SIZE,
    currentPage * PROJECTS_PAGE_SIZE
  );
  const hasActiveFilters =
    Boolean(query.trim()) ||
    Boolean(location.trim()) ||
    Boolean(developerSlug) ||
    statusFilter !== 'All' ||
    verifiedOnly;

  function resetFilters() {
    setQuery('');
    setLocation('');
    setDeveloperSlug('');
    setStatusFilter('All');
    setVerifiedOnly(false);
    setPage(1);
  }

  return (
    <main className="projects-page marketplace-directory-page">
      <section className="page-section page-section--hero container">
        <SectionHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

        <div className="projects-trust-banner">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>{copy.trust}</span>
        </div>
      </section>

      <section className="page-section container">
        <div className="filters-shell projects-filters-shell" aria-labelledby="projects-filter-title">
          <div className="filters-header">
            <div>
              <p className="eyebrow">{copy.eyebrow}</p>
              <h2 id="projects-filter-title">{copy.filters}</h2>
            </div>

            {hasActiveFilters ? (
              <button className="reset-filter-button" type="button" onClick={resetFilters}>
                <RotateCcw size={16} aria-hidden="true" />
                {copy.reset}
              </button>
            ) : null}
          </div>

          <div className="normal-filters projects-filter-grid">
            <label>
              <span>{copy.search}</span>
              <div className="search-input">
                <Search size={17} aria-hidden="true" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
            </label>

            <label>
              <span>{copy.location}</span>
              <div className="search-input">
                <MapPin size={17} aria-hidden="true" />
                <input value={location} onChange={(event) => setLocation(event.target.value)} />
              </div>
            </label>

            <label>
              <span>{copy.developer}</span>
              <select value={developerSlug} onChange={(event) => setDeveloperSlug(event.target.value)}>
                <option value="">{copy.allDevelopers}</option>
                {developers.map((developer) => (
                  <option key={developer.id} value={developer.slug}>
                    {developer.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>{copy.status}</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as ProjectStatusFilter)}
              >
                {projectStatusFilters.map((filter) => (
                  <option key={filter} value={filter}>
                    {filter}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="projects-toggle-row">
            <button
              className={verifiedOnly ? 'active' : ''}
              type="button"
              onClick={() => setVerifiedOnly((value) => !value)}
            >
              <ShieldCheck size={16} aria-hidden="true" />
              {copy.verifiedOnly}
            </button>

            {hasActiveFilters ? (
              <button type="button" onClick={resetFilters}>
                <X size={16} aria-hidden="true" />
                {copy.clear}
              </button>
            ) : null}
          </div>
        </div>

        <div className="directory-results-header">
          <p>
            <Filter size={16} aria-hidden="true" />
            {copy.showing} <strong>{filteredProjects.length}</strong> {copy.result}
            {filteredProjects.length === 1 ? '' : 's'}
          </p>
        </div>

        {loading ? (
          <div className="empty-state empty-state--premium" role="status">
            <SlidersHorizontal size={34} aria-hidden="true" />
            <h2>{copy.loading}</h2>
          </div>
        ) : loadError ? (
          <div className="empty-state empty-state--premium" role="alert">
            <Building2 size={34} aria-hidden="true" />
            <h2>{loadError}</h2>
          </div>
        ) : paginatedProjects.length > 0 ? (
          <div className="listing-grid projects-grid">
            {paginatedProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="empty-state empty-state--premium">
            <Sparkles size={34} aria-hidden="true" />
            <h2>{copy.emptyTitle}</h2>
            <p>{copy.emptyText}</p>
          </div>
        )}

        {pageCount > 1 ? (
          <div className="pagination-controls" aria-label="Projects pagination">
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                className={pageNumber === currentPage ? 'active' : ''}
                type="button"
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
