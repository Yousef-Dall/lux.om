type MediaQualityGuidanceProps = {
  item: unknown;
  itemType: 'listing' | 'activity' | 'project';
  language: 'en' | 'ar';
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getValue(item: unknown, key: string) {
  return isRecord(item) ? item[key] : undefined;
}

function getText(item: unknown, key: string, fallback = '') {
  const value = getValue(item, key);

  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);

  return fallback;
}

function getArray(item: unknown, key: string) {
  const value = getValue(item, key);

  return Array.isArray(value) ? value : [];
}

function hasMediaUrl(item: unknown) {
  return Boolean(
    getText(item, 'videoWalkthroughUrl') ||
      getText(item, 'tour360Url') ||
      getText(item, 'virtualTourUrl') ||
      getText(item, 'floorPlanUrl') ||
      getArray(item, 'premiumMedia').length
  );
}

function getSuggestions(item: unknown, itemType: 'listing' | 'activity' | 'project', language: 'en' | 'ar') {
  const suggestions: string[] = [];
  const images = getArray(item, 'images');
  const mainImage = getText(item, 'image');
  const mediaQualityStatus = getText(item, 'mediaQualityStatus', 'NOT_CHECKED');
  const enhancementStatus = getText(item, 'enhancementStatus', 'NOT_REQUESTED');

  if (!mainImage && images.length === 0) {
    suggestions.push(
      language === 'ar'
        ? 'أضف صورة رئيسية واضحة.'
        : 'Add a clear main image.'
    );
  }

  if (images.length > 0 && images.length < 3) {
    suggestions.push(
      language === 'ar'
        ? 'أضف صوراً إضافية من الداخل والخارج.'
        : 'Add more interior and exterior photos.'
    );
  }

  if (!hasMediaUrl(item)) {
    suggestions.push(
      itemType === 'listing'
        ? language === 'ar'
          ? 'أضف مخططاً أو جولة 360 أو فيديو قصير.'
          : 'Add a floor plan, 360 tour, or short walkthrough video.'
        : itemType === 'project'
          ? language === 'ar'
            ? 'أضف مخططاً عاماً أو فيديو قصير للمشروع.'
            : 'Add a masterplan or short project walkthrough video.'
          : language === 'ar'
            ? 'أضف فيديو أو جولة افتراضية للنشاط.'
            : 'Add a video or virtual tour for this activity.'
    );
  }

  if (mediaQualityStatus === 'NEEDS_REVIEW' || mediaQualityStatus === 'BLOCKED') {
    suggestions.push(
      language === 'ar'
        ? 'راجع جودة الصور قبل النشر النهائي.'
        : 'Review media quality before final publishing.'
    );
  }

  if (enhancementStatus === 'NOT_CONFIGURED') {
    suggestions.push(
      language === 'ar'
        ? 'خدمة تحسين الصور غير مفعلة حالياً.'
        : 'Image enhancement service is not configured.'
    );
  }

  return suggestions.slice(0, 4);
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').toLowerCase();
}

export default function MediaQualityGuidance({
  item,
  itemType,
  language
}: MediaQualityGuidanceProps) {
  const mediaQualityStatus = getText(item, 'mediaQualityStatus', 'NOT_CHECKED');
  const mediaQualityNotes = getText(item, 'mediaQualityNotes', '');
  const enhancementStatus = getText(item, 'enhancementStatus', 'NOT_REQUESTED');
  const suggestions = getSuggestions(item, itemType, language);

  return (
    <div className="media-quality-guidance">
      <div>
        <strong>{language === 'ar' ? 'جودة الوسائط' : 'Media quality'}</strong>
        <span>{formatStatus(mediaQualityStatus)}</span>
      </div>

      {mediaQualityNotes ? <p>{mediaQualityNotes}</p> : null}

      <p className="trust-note">
        {language === 'ar'
          ? `حالة التحسين: ${formatStatus(enhancementStatus)}`
          : `Enhancement status: ${formatStatus(enhancementStatus)}`}
      </p>

      {suggestions.length ? (
        <ul>
          {suggestions.map((suggestion) => (
            <li key={suggestion}>{suggestion}</li>
          ))}
        </ul>
      ) : (
        <p className="trust-note">
          {language === 'ar'
            ? 'الوسائط تبدو مناسبة حالياً.'
            : 'Media looks acceptable for now.'}
        </p>
      )}
    </div>
  );
}
