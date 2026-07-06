import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CheckCircle2, Clock3, Eye, RefreshCw, XCircle } from 'lucide-react';

import {
  getAdminDeveloperProjects,
  updateAdminDeveloperProjectStatus
} from '../api/admin';
import { ApiError } from '../api/client';
import type { ApiDeveloperProject, DeveloperProjectStatus } from '../types';

const statusFilters: Array<DeveloperProjectStatus | 'ALL'> = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

function getStatusLabel(status: DeveloperProjectStatus | 'ALL') {
  return status === 'ALL' ? 'All projects' : status.replace(/_/g, ' ').toLowerCase();
}

function getProjectName(project: ApiDeveloperProject) {
  return project.nameEn || project.nameAr || 'Untitled project';
}

function getProjectLocation(project: ApiDeveloperProject) {
  return project.locationEn || project.locationAr || 'Location not set';
}

function getDeveloperName(project: ApiDeveloperProject) {
  return project.developer?.nameEn || project.developer?.nameAr || 'Developer company';
}

function formatPrice(project: ApiDeveloperProject) {
  if (!project.startingPriceAmount) return 'Price not set';

  const prefix = project.priceQualifier === 'FROM' ? 'From ' : '';

  return prefix + (project.priceCurrency ?? 'OMR') + ' ' + project.startingPriceAmount;
}

function getDate(value?: string | null) {
  if (!value) return 'No handover date';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'No handover date';

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium'
  }).format(date);
}

export default function AdminDeveloperProjectReviewPanel({ token }: { token: string }) {
  const [projects, setProjects] = useState<ApiDeveloperProject[]>([]);
  const [statusFilter, setStatusFilter] = useState<DeveloperProjectStatus | 'ALL'>('PENDING');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatingId, setUpdatingId] = useState('');

  const metrics = useMemo(() => {
    const pending = projects.filter((project) => project.status === 'PENDING').length;
    const approved = projects.filter((project) => project.status === 'APPROVED').length;
    const rejected = projects.filter((project) => project.status === 'REJECTED').length;
    const units = projects.reduce((total, project) => total + (project._count?.listings ?? project.listings?.length ?? 0), 0);

    return {
      pending,
      approved,
      rejected,
      units
    };
  }, [projects]);

  const filteredProjects = useMemo(
    () =>
      statusFilter === 'ALL'
        ? projects
        : projects.filter((project) => project.status === statusFilter),
    [projects, statusFilter]
  );

  async function loadProjects() {
    try {
      setLoading(true);
      setLoadError('');

      const response = await getAdminDeveloperProjects(token, {
        status: 'ALL',
        take: 100
      });

      setProjects(response.projects);
    } catch (error) {
      console.error(error);
      setLoadError(error instanceof ApiError || error instanceof Error ? error.message : 'Could not load developer projects.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function updateStatus(project: ApiDeveloperProject, status: DeveloperProjectStatus) {
    const rejectedReason =
      status === 'REJECTED'
        ? window.prompt('Why is this project not ready for publishing yet?')?.trim()
        : undefined;

    if (status === 'REJECTED' && !rejectedReason) return;

    try {
      setUpdatingId(project.id);

      const response = await updateAdminDeveloperProjectStatus(
        project.id,
        {
          status,
          rejectedReason
        },
        token
      );

      setProjects((current) =>
        current.map((currentProject) =>
          currentProject.id === project.id ? response.project : currentProject
        )
      );
    } catch (error) {
      console.error(error);
      alert(error instanceof ApiError || error instanceof Error ? error.message : 'Could not update project status.');
    } finally {
      setUpdatingId('');
    }
  }

  return (
    <section id="admin-developer-projects" className="admin-project-review-panel admin-project-review-panel--command admin-anchor-section" tabIndex={-1}>
      <div className="admin-project-review-panel__header">
        <div>
          <p className="eyebrow">Developer project review</p>
          <h2>Project approvals and unit readiness</h2>
          <p>
            Review full development projects before they go public, then monitor the linked unit inventory that will power each project page.
          </p>
        </div>

        <button className="button-link button-link--secondary" type="button" onClick={() => void loadProjects()} disabled={loading}>
          <RefreshCw size={15} aria-hidden="true" />
          Refresh projects
        </button>
      </div>

      <div className="admin-project-review-metrics">
        <article className={metrics.pending > 0 ? 'is-urgent' : ''}>
          <Clock3 size={18} aria-hidden="true" />
          <span>Pending review</span>
          <strong>{metrics.pending}</strong>
        </article>
        <article>
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>Approved projects</span>
          <strong>{metrics.approved}</strong>
        </article>
        <article>
          <XCircle size={18} aria-hidden="true" />
          <span>Rejected / changes</span>
          <strong>{metrics.rejected}</strong>
        </article>
        <article>
          <Building2 size={18} aria-hidden="true" />
          <span>Linked units</span>
          <strong>{metrics.units}</strong>
        </article>
      </div>

      <div className="admin-project-review-toolbar" aria-label="Developer project status filters">
        {statusFilters.map((status) => (
          <button
            key={status}
            type="button"
            className={statusFilter === status ? 'is-active' : ''}
            onClick={() => setStatusFilter(status)}
          >
            {getStatusLabel(status)}
          </button>
        ))}
      </div>

      {loadError ? <p className="form-error" role="alert">{loadError}</p> : null}

      {loading ? <p className="trust-note">Loading developer projects...</p> : null}

      {!loading && !filteredProjects.length ? (
        <div className="empty-state empty-state--premium admin-project-review-empty">
          <Building2 size={32} aria-hidden="true" />
          <h3>No developer projects in this queue.</h3>
          <p>Projects submitted by developers will appear here before they go public.</p>
        </div>
      ) : null}

      <div className="admin-project-review-list">
        {filteredProjects.map((project) => (
          <article key={project.id} className="admin-project-review-card">
            {project.image ? <img src={project.image} alt="" loading="lazy" /> : <div className="admin-project-review-card__placeholder">Project</div>}

            <div className="admin-project-review-card__body">
              <div className="admin-project-review-card__title">
                <div>
                  <span className={'admin-project-review-status admin-project-review-status--' + (project.status?.toLowerCase() ?? 'pending')}>
                    {project.status?.toLowerCase() ?? 'pending'}
                  </span>
                  <h3>{getProjectName(project)}</h3>
                  <p>{getDeveloperName(project)} · {getProjectLocation(project)}</p>
                </div>

                {project.status === 'APPROVED' ? (
                  <Link className="button-link button-link--ghost" to={"/developer-projects/" + project.slug}>
                    <Eye size={15} aria-hidden="true" />
                    Open public page
                  </Link>
                ) : (
                  <span className="button-link button-link--secondary admin-project-review-card__disabled-link">
                    Public after approval
                  </span>
                )}
              </div>

              <div className="admin-project-review-facts">
                <span>{project.completionStatus ?? 'Status not set'}</span>
                <span>{getDate(project.handoverDate)}</span>
                <span>{project.availableUnits ?? '—'} / {project.totalUnits ?? '—'} units</span>
                <span>{formatPrice(project)}</span>
              </div>

              {project.rejectedReason ? (
                <p className="admin-project-review-note">Last rejection note: {project.rejectedReason}</p>
              ) : null}

              <div className="admin-project-review-actions">
                <button
                  type="button"
                  className="button-link"
                  disabled={updatingId === project.id || project.status === 'APPROVED'}
                  onClick={() => void updateStatus(project, 'APPROVED')}
                >
                  Approve project
                </button>
                <button
                  type="button"
                  className="button-link button-link--secondary"
                  disabled={updatingId === project.id || project.status === 'REJECTED'}
                  onClick={() => void updateStatus(project, 'REJECTED')}
                >
                  Request changes
                </button>
                {project.status !== 'PENDING' ? (
                  <button
                    type="button"
                    className="button-link button-link--secondary"
                    disabled={updatingId === project.id}
                    onClick={() => void updateStatus(project, 'PENDING')}
                  >
                    Move to review
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
