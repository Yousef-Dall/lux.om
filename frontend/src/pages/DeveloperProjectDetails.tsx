import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getDeveloperProjectBySlug } from '../api/developerProjects';
import ButtonLink from '../components/ButtonLink';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import type { DeveloperProject } from '../types';

export default function DeveloperProjectDetails() {
  const { slug } = useParams();
  const { language } = useLanguage();
  const [project, setProject] = useState<DeveloperProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useDocumentTitle(project ? project.name : 'Developer project');

  useEffect(() => {
    let isMounted = true;

    async function loadProject() {
      if (!slug) return;
      try {
        setLoading(true);
        setError('');
        const apiProject = await getDeveloperProjectBySlug(slug, language);
        if (isMounted) setProject(apiProject);
      } catch (loadError) {
        console.error(loadError);
        if (isMounted) setError(language === 'ar' ? 'تعذر تحميل المشروع.' : 'Could not load this project.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadProject();

    return () => {
      isMounted = false;
    };
  }, [language, slug]);

  if (loading) {
    return <section className="page-section container"><p>{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p></section>;
  }

  if (error || !project) {
    return <section className="page-section container"><SectionHeader eyebrow="Developer project" title={error || 'Project not found'} /></section>;
  }

  return (
    <section className="page-section container developer-project-detail-page">
      <SectionHeader
        eyebrow={language === 'ar' ? 'مشروع مطور عقاري' : 'Developer project'}
        title={project.name}
        description={project.description}
        actions={project.developer ? <ButtonLink to={'/developers/' + project.developer.slug} variant="secondary">{project.developer.name}</ButtonLink> : null}
      />

      <div className="developer-project-hero-card">
        {project.image ? <img src={project.image} alt={project.name} /> : null}
        <div>
          <p className="eyebrow">{project.location}</p>
          <h2>{project.completionStatus || (language === 'ar' ? 'مشروع جديد' : 'New development')}</h2>
          <dl>
            <div><dt>{language === 'ar' ? 'إجمالي الوحدات' : 'Total units'}</dt><dd>{project.totalUnits ?? '—'}</dd></div>
            <div><dt>{language === 'ar' ? 'المتاح' : 'Available'}</dt><dd>{project.availableUnits ?? '—'}</dd></div>
            <div><dt>{language === 'ar' ? 'الغرف' : 'Unit mix'}</dt><dd>{project.bedroomsSummary || '—'}</dd></div>
            <div><dt>{language === 'ar' ? 'السعر يبدأ من' : 'Starting price'}</dt><dd>{project.startingPriceAmount ? project.startingPriceAmount + ' ' + (project.priceCurrency ?? '') : '—'}</dd></div>
          </dl>
        </div>
      </div>

      <div className="developer-project-content-grid">
        <article>
          <h2>{language === 'ar' ? 'عن المشروع' : 'About the project'}</h2>
          <p>{project.description}</p>
          {project.paymentPlan ? <><h3>{language === 'ar' ? 'خطة الدفع' : 'Payment plan'}</h3><p>{project.paymentPlan}</p></> : null}
          {project.amenities.length ? <div className="amenity-filter-list">{project.amenities.map((amenity) => <span key={amenity}>{amenity}</span>)}</div> : null}
        </article>
        <aside>
          {project.brochureUrl ? <a className="button-link button-link--secondary" href={project.brochureUrl} target="_blank" rel="noreferrer">{language === 'ar' ? 'تحميل البروشور' : 'Open brochure'}</a> : null}
          {project.masterplanUrl ? <a className="button-link button-link--ghost" href={project.masterplanUrl} target="_blank" rel="noreferrer">{language === 'ar' ? 'المخطط العام' : 'Masterplan'}</a> : null}
          {project.videoWalkthroughUrl ? <a className="button-link button-link--ghost" href={project.videoWalkthroughUrl} target="_blank" rel="noreferrer">{language === 'ar' ? 'فيديو المشروع' : 'Project video'}</a> : null}
        </aside>
      </div>

      <section className="form-section-card">
        <div className="form-group-heading">
          <div>
            <p className="eyebrow">{language === 'ar' ? 'الوحدات' : 'Units'}</p>
            <h2>{language === 'ar' ? 'الوحدات المتاحة في المشروع' : 'Available units in this project'}</h2>
          </div>
        </div>
        {project.units?.length ? (
          <div className="dashboard-v2-record-grid">
            {project.units.map((unit) => (
              <article className="dashboard-v2-record-card" key={unit.id}>
                <img src={unit.image} alt={unit.title} />
                <div className="dashboard-v2-record-card__body">
                  <h3>{unit.title}</h3>
                  <p>{unit.location}</p>
                  <strong>{unit.price}</strong>
                  <Link className="button-link button-link--secondary" to={'/listings/' + unit.slug}>{language === 'ar' ? 'عرض الوحدة' : 'View unit'}</Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p>{language === 'ar' ? 'لم تتم إضافة وحدات منشورة لهذا المشروع بعد.' : 'No published units have been added to this project yet.'}</p>
        )}
      </section>
    </section>
  );
}
