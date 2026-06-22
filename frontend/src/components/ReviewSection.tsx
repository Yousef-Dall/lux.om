import { FormEvent, useEffect, useState } from 'react';

import { createReview, getReviews } from '../api/reviews';
import { useAuth } from '../auth/AuthContext';

type ReviewSectionProps = {
targetType: 'ACTIVITY' | 'TRAVEL_AGENCY' | 'DEVELOPER' | 'LISTING';
targetId: string;
};

function getSafeRating(value: unknown) {
const rating = Number(value);

if (!Number.isFinite(rating)) return 0;

return Math.min(Math.max(Math.round(rating), 0), 5);
}

export default function ReviewSection({ targetType, targetId }: ReviewSectionProps) {
const { token, isAuthenticated } = useAuth();
const [reviews, setReviews] = useState<Record<string, unknown>[]>([]);
const [rating, setRating] = useState(5);
const [body, setBody] = useState('');
const [submitted, setSubmitted] = useState(false);
const [submitting, setSubmitting] = useState(false);
const [submitError, setSubmitError] = useState('');

useEffect(() => {
let active = true;


getReviews({ targetType, targetId })
  .then((response) => {
    if (active) setReviews(response.reviews);
  })
  .catch(() => {
    if (active) setReviews([]);
  });

return () => {
  active = false;
};


}, [targetId, targetType]);

async function handleSubmit(event: FormEvent) {
event.preventDefault();


if (!token || submitting) return;

const trimmedBody = body.trim();

if (!trimmedBody) {
  setSubmitError('Please write a short review before submitting.');
  return;
}

try {
  setSubmitting(true);
  setSubmitError('');

  await createReview({ targetType, targetId, rating, body: trimmedBody }, token);

  setSubmitted(true);
  setBody('');
} catch {
  setSubmitError('Could not submit your review right now. Please try again.');
} finally {
  setSubmitting(false);
}


}

const titleId = `${targetType.toLowerCase()}-reviews-title`;

return ( <section className="review-section" aria-labelledby={titleId}> <div className="review-section__header"> <div> <p className="eyebrow">Community feedback</p> <h2 id={titleId}>Reviews</h2> <p>
Reviews are moderated before they appear publicly, helping keep lux.om useful and trustworthy. </p> </div>


    <div className="review-section__summary" aria-label={`${reviews.length} approved reviews`}>
      <strong>{reviews.length}</strong>
      <span>approved reviews</span>
    </div>
  </div>

  <div className="review-list">
    {reviews.length ? (
      reviews.map((review, index) => {
        const safeRating = getSafeRating(review.rating);

        return (
          <article key={String(review.id ?? index)} className="review-card">
            <div className="review-card__rating" aria-label={`${safeRating} out of 5 stars`}>
              {'★'.repeat(safeRating)}
            </div>
            <p>{String(review.body ?? review.title ?? 'Review submitted.')}</p>
          </article>
        );
      })
    ) : (
      <div className="review-empty-state">
        <strong>No approved reviews yet.</strong>
        <p>Approved customer feedback will appear here after moderation.</p>
      </div>
    )}
  </div>

  {isAuthenticated ? (
    <form className="review-form" onSubmit={handleSubmit}>
      <div className="review-form__grid">
        <label>
          Rating
          <select value={rating} onChange={(event) => setRating(Number(event.target.value))}>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value} star{value === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </label>

        <label className="review-form__textarea">
          Review
          <textarea
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              setSubmitted(false);
              setSubmitError('');
            }}
            placeholder="Share a short, helpful review for future guests or buyers."
            rows={4}
          />
        </label>
      </div>

      {submitError ? (
        <p className="form-error" role="alert">
          {submitError}
        </p>
      ) : null}

      {submitted ? (
        <p className="trust-note" role="status">
          Review submitted for moderation. It will appear after admin approval.
        </p>
      ) : null}

      <button className="button-link button-link--primary" type="submit" disabled={submitting}>
        {submitting ? 'Submitting...' : 'Submit review'}
      </button>
    </form>
  ) : (
    <p className="trust-note">Sign in to submit a moderated review.</p>
  )}
</section>


);
}
