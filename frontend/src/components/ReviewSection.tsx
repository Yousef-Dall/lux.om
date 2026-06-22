import { FormEvent, useEffect, useState } from 'react';

import { createReview, getReviews } from '../api/reviews';
import { useAuth } from '../auth/AuthContext';

type ReviewSectionProps = {
  targetType: 'ACTIVITY' | 'TRAVEL_AGENCY' | 'DEVELOPER' | 'LISTING';
  targetId: string;
};

export default function ReviewSection({ targetType, targetId }: ReviewSectionProps) {
  const { token, isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState<Record<string, unknown>[]>([]);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    getReviews({ targetType, targetId }).then((response) => setReviews(response.reviews)).catch(() => setReviews([]));
  }, [targetId, targetType]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;

    await createReview({ targetType, targetId, rating, body }, token);
    setSubmitted(true);
    setBody('');
  }

  return (
    <section className="review-section">
      <h2>Reviews</h2>
      <div className="review-list">
        {reviews.length ? reviews.map((review, index) => (
          <article key={String(review.id ?? index)} className="review-card">
            <strong>{'★'.repeat(Number(review.rating ?? 0))}</strong>
            <p>{String(review.body ?? review.title ?? 'Review submitted.')}</p>
          </article>
        )) : <p>No approved reviews yet.</p>}
      </div>

      {isAuthenticated ? (
        <form className="review-form" onSubmit={handleSubmit}>
          <label>
            Rating
            <select value={rating} onChange={(event) => setRating(Number(event.target.value))}>
              {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>
            Review
            <textarea value={body} onChange={(event) => setBody(event.target.value)} />
          </label>
          {submitted ? (
            <p className="trust-note" role="status">Review submitted for moderation. It will appear after admin approval.</p>
          ) : null}
          <button className="button-link button-link--primary" type="submit">Submit review</button>
        </form>
      ) : null}
    </section>
  );
}
