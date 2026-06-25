import { useEffect, useState } from 'react';
import { PencilLine, X } from 'lucide-react';

import {
  updateActivity,
  updateListing,
  type UpdateActivityPayload,
  type UpdateListingPayload
} from '../api/marketplace';
import type { Activity, Language, Listing } from '../types';

type OwnerMarketplaceEditModalProps = {
  listing?: Listing | null;
  activity?: Activity | null;
  token: string | null;
  language: Language;
  onClose: () => void;
  onUpdated: () => void | Promise<void>;
};

const priceQualifierOptions = ['FIXED', 'FROM', 'ON_REQUEST'] as const;
const priceUnitOptions = ['TOTAL', 'PER_MONTH', 'PER_NIGHT', 'PER_PERSON'] as const;
const travelRegionOptions = ['INSIDE_OMAN', 'OUTSIDE_OMAN'] as const;
const dayOptions = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toText(value: unknown) {
  if (value === null || value === undefined) return '';

  return String(value);
}

function toNumber(value: string) {
  if (!value.trim()) return undefined;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function hasChanged(next: string, previous: unknown) {
  return next.trim() !== toText(previous).trim();
}

function addTextIfChanged<T extends Record<string, unknown>>(
  payload: T,
  key: keyof T,
  next: string,
  previous: unknown
) {
  if (!hasChanged(next, previous)) return;
  if (!next.trim()) return;

  payload[key] = next.trim() as T[keyof T];
}

function addNullableUrlIfChanged<T extends Record<string, unknown>>(
  payload: T,
  key: keyof T,
  next: string,
  previous: unknown
) {
  if (!hasChanged(next, previous)) return;

  payload[key] = (next.trim() || null) as T[keyof T];
}

function getActivityField(
  activity: Activity | null | undefined,
  key: string
) {
  const value = (activity as Record<string, unknown> | null | undefined)?.[key];

  return value;
}

function getActivityDays(activity: Activity | null | undefined) {
  const value = (activity as { availabilityDays?: unknown } | null | undefined)
    ?.availabilityDays;

  return Array.isArray(value)
    ? value.filter((day): day is string => typeof day === 'string')
    : [];
}

export default function OwnerMarketplaceEditModal({
  listing,
  activity,
  token,
  language,
  onClose,
  onUpdated
}: OwnerMarketplaceEditModalProps) {
  const isListing = Boolean(listing);
  const isActivity = Boolean(activity);

  const copy =
    language === 'ar'
      ? {
          title: isListing ? 'تعديل العقار' : 'تعديل النشاط',
          description:
            'تعديل السعر أو الوسائط يبقى الإعلان منشوراً غالباً. تعديل العنوان أو الموقع أو الوصف قد يعيد الإعلان للمراجعة.',
          name: 'العنوان',
          details: 'الوصف',
          location: 'الموقع',
          type: isListing ? 'نوع العقار' : 'تصنيف النشاط',
          price: 'السعر النصي',
          amount: 'المبلغ',
          currency: 'العملة',
          qualifier: 'نوع السعر',
          unit: 'وحدة السعر',
          beds: 'غرف النوم',
          baths: 'الحمامات',
          sqm: 'المساحة',
          capacity: 'السعة',
          travelRegion: 'نطاق النشاط',
          availabilityDays: 'أيام التوفر',
          startTime: 'وقت البداية',
          endTime: 'وقت النهاية',
          image: 'الصورة الرئيسية',
          video: 'رابط فيديو',
          tour360: 'رابط 360',
          virtualTour: 'رابط الجولة الافتراضية',
          floorPlan: 'رابط المخطط',
          reviewWarning:
            'تنبيه: تغييرات العنوان أو الموقع أو الوصف قد تعيد الإعلان إلى المراجعة.',
          save: 'حفظ التعديلات',
          saving: 'جاري الحفظ...',
          success: 'تم حفظ التعديلات.',
          error: 'تعذر حفظ التعديلات حالياً.',
          login: 'يجب تسجيل الدخول للتعديل.',
          close: 'إغلاق'
        }
      : {
          title: isListing ? 'Edit listing' : 'Edit activity',
          description:
            'Price or media edits usually stay live. Title, location, description, or other sensitive edits may move the item back to review.',
          name: 'Title',
          details: 'Description',
          location: 'Location',
          type: isListing ? 'Property type' : 'Activity category',
          price: 'Display price',
          amount: 'Amount',
          currency: 'Currency',
          qualifier: 'Price type',
          unit: 'Price unit',
          beds: 'Beds',
          baths: 'Baths',
          sqm: 'Area',
          capacity: 'Capacity',
          travelRegion: 'Activity region',
          availabilityDays: 'Available days',
          startTime: 'Start time',
          endTime: 'End time',
          image: 'Main image',
          video: 'Video URL',
          tour360: '360 tour URL',
          virtualTour: 'Virtual tour URL',
          floorPlan: 'Floor plan URL',
          reviewWarning:
            'Note: title, location, description, and other sensitive changes may return this item to review.',
          save: 'Save changes',
          saving: 'Saving...',
          success: 'Changes saved.',
          error: 'Could not save changes right now.',
          login: 'Sign in to edit.',
          close: 'Close'
        };

  const source = listing ?? activity;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [kind, setKind] = useState('');
  const [price, setPrice] = useState('');
  const [priceAmount, setPriceAmount] = useState('');
  const [priceCurrency, setPriceCurrency] = useState('OMR');
  const [priceQualifier, setPriceQualifier] = useState('FIXED');
  const [priceUnit, setPriceUnit] = useState('TOTAL');
  const [beds, setBeds] = useState('');
  const [baths, setBaths] = useState('');
  const [sqm, setSqm] = useState('');
  const [capacity, setCapacity] = useState('');
  const [travelRegion, setTravelRegion] = useState<'INSIDE_OMAN' | 'OUTSIDE_OMAN'>(
    'INSIDE_OMAN'
  );
  const [availabilityDays, setAvailabilityDays] = useState<string[]>([]);
  const [availabilityStartTime, setAvailabilityStartTime] = useState('');
  const [availabilityEndTime, setAvailabilityEndTime] = useState('');
  const [image, setImage] = useState('');
  const [videoWalkthroughUrl, setVideoWalkthroughUrl] = useState('');
  const [tour360Url, setTour360Url] = useState('');
  const [virtualTourUrl, setVirtualTourUrl] = useState('');
  const [floorPlanUrl, setFloorPlanUrl] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!source) return;

    setTitle(toText(source.title));
    setDescription(toText(source.description));
    setLocation(toText(source.location));
    setKind(isListing ? toText((source as Listing).type) : toText((source as Activity).category));
    setPrice(toText(source.price));
    setPriceAmount(toText(source.priceAmount));
    setPriceCurrency(toText(source.priceCurrency) || 'OMR');
    setPriceQualifier(toText(source.priceQualifier) || 'FIXED');
    setPriceUnit(toText(source.priceUnit) || 'TOTAL');

    if (isListing && listing) {
      setBeds(toText(listing.beds));
      setBaths(toText(listing.baths));
      setSqm(toText(listing.sqm));
      setImage(toText(listing.image));
      setFloorPlanUrl(toText(listing.floorPlanUrl));
    }

    if (isActivity && activity) {
      setCapacity(toText(activity.capacity));
      setTravelRegion(
        activity.travelRegion === 'OUTSIDE_OMAN' ? 'OUTSIDE_OMAN' : 'INSIDE_OMAN'
      );
      setAvailabilityDays(getActivityDays(activity));
      setAvailabilityStartTime(toText(getActivityField(activity, 'availabilityStartTime')));
      setAvailabilityEndTime(toText(getActivityField(activity, 'availabilityEndTime')));
    }

    setVideoWalkthroughUrl(toText(source.videoWalkthroughUrl));
    setTour360Url(toText(source.tour360Url));
    setVirtualTourUrl(toText(source.virtualTourUrl));
  }, [source, isListing, isActivity, listing, activity]);

  if (!source) return null;

  function toggleDay(day: string) {
    setAvailabilityDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day]
    );
  }

  async function handleSubmit() {
    if (!token) {
      setErrorMessage(copy.login);
      return;
    }

    try {
      setSaving(true);
      setStatusMessage('');
      setErrorMessage('');

      if (isListing && listing) {
        const payload: UpdateListingPayload = {};

        addTextIfChanged(payload, 'title', title, listing.title);
        addTextIfChanged(payload, 'description', description, listing.description);
        addTextIfChanged(payload, 'location', location, listing.location);
        addTextIfChanged(payload, 'type', kind, listing.type);
        addTextIfChanged(payload, 'price', price, listing.price);
        addTextIfChanged(payload, 'priceCurrency', priceCurrency, listing.priceCurrency);
        addTextIfChanged(payload, 'priceQualifier', priceQualifier, listing.priceQualifier);
        addTextIfChanged(payload, 'priceUnit', priceUnit, listing.priceUnit);

        if (hasChanged(priceAmount, listing.priceAmount)) {
          const amount = toNumber(priceAmount);
          if (amount !== undefined) payload.priceAmount = amount;
        }

        if (hasChanged(beds, listing.beds)) {
          const value = toNumber(beds);
          if (value !== undefined) payload.beds = value;
        }

        if (hasChanged(baths, listing.baths)) {
          const value = toNumber(baths);
          if (value !== undefined) payload.baths = value;
        }

        if (hasChanged(sqm, listing.sqm)) {
          const value = toNumber(sqm);
          if (value !== undefined) payload.sqm = value;
        }

        addTextIfChanged(payload, 'image', image, listing.image);
        addNullableUrlIfChanged(
          payload,
          'videoWalkthroughUrl',
          videoWalkthroughUrl,
          listing.videoWalkthroughUrl
        );
        addNullableUrlIfChanged(payload, 'tour360Url', tour360Url, listing.tour360Url);
        addNullableUrlIfChanged(
          payload,
          'virtualTourUrl',
          virtualTourUrl,
          listing.virtualTourUrl
        );
        addNullableUrlIfChanged(payload, 'floorPlanUrl', floorPlanUrl, listing.floorPlanUrl);

        await updateListing(listing.id, payload, token, language);
      }

      if (isActivity && activity) {
        const payload: UpdateActivityPayload = {};

        addTextIfChanged(payload, 'titleEn', title, activity.title);
        addTextIfChanged(payload, 'descriptionEn', description, activity.description);
        addTextIfChanged(payload, 'locationEn', location, activity.location);
        addTextIfChanged(payload, 'categoryEn', kind, activity.category);
        addTextIfChanged(payload, 'price', price, activity.price);
        addTextIfChanged(payload, 'priceCurrency', priceCurrency, activity.priceCurrency);
        addTextIfChanged(payload, 'priceQualifier', priceQualifier, activity.priceQualifier);
        addTextIfChanged(payload, 'priceUnit', priceUnit, activity.priceUnit);

        if (hasChanged(priceAmount, activity.priceAmount)) {
          const amount = toNumber(priceAmount);
          if (amount !== undefined) payload.priceAmount = amount;
        }

        if (hasChanged(capacity, activity.capacity)) {
          const value = toNumber(capacity);
          if (value !== undefined) payload.capacity = value;
        }

        if (travelRegion !== activity.travelRegion) {
          payload.travelRegion = travelRegion;
        }

        if (availabilityDays.join(',') !== getActivityDays(activity).join(',')) {
          payload.availabilityDays = availabilityDays;
        }

        addTextIfChanged(
          payload,
          'availabilityStartTime',
          availabilityStartTime,
          getActivityField(activity, 'availabilityStartTime')
        );
        addTextIfChanged(
          payload,
          'availabilityEndTime',
          availabilityEndTime,
          getActivityField(activity, 'availabilityEndTime')
        );
        addNullableUrlIfChanged(
          payload,
          'videoWalkthroughUrl',
          videoWalkthroughUrl,
          activity.videoWalkthroughUrl
        );
        addNullableUrlIfChanged(payload, 'tour360Url', tour360Url, activity.tour360Url);
        addNullableUrlIfChanged(
          payload,
          'virtualTourUrl',
          virtualTourUrl,
          activity.virtualTourUrl
        );

        await updateActivity(activity.id, payload, token, language);
      }

      await onUpdated();
      setStatusMessage(copy.success);
      setTimeout(onClose, 350);
    } catch (error) {
      console.error(error);
      setErrorMessage(copy.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="owner-edit-modal__backdrop" role="presentation">
      <div
        aria-label={copy.title}
        aria-modal="true"
        className="owner-edit-modal"
        role="dialog"
      >
        <div className="owner-edit-modal__header">
          <div>
            <p className="eyebrow">
              <PencilLine size={15} aria-hidden="true" />
              {copy.title}
            </p>
            <h2>{title || copy.title}</h2>
            <p>{copy.description}</p>
          </div>

          <button
            aria-label={copy.close}
            className="owner-edit-modal__close"
            type="button"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p className="trust-note">{copy.reviewWarning}</p>

        <div className="owner-edit-modal__grid">
          <label>
            {copy.name}
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>

          <label>
            {copy.location}
            <input value={location} onChange={(event) => setLocation(event.target.value)} />
          </label>

          <label>
            {copy.type}
            <input value={kind} onChange={(event) => setKind(event.target.value)} />
          </label>

          <label className="owner-edit-modal__full">
            {copy.details}
            <textarea
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <label>
            {copy.price}
            <input value={price} onChange={(event) => setPrice(event.target.value)} />
          </label>

          <label>
            {copy.amount}
            <input
              inputMode="decimal"
              value={priceAmount}
              onChange={(event) => setPriceAmount(event.target.value)}
            />
          </label>

          <label>
            {copy.currency}
            <input
              value={priceCurrency}
              onChange={(event) => setPriceCurrency(event.target.value.toUpperCase())}
            />
          </label>

          <label>
            {copy.qualifier}
            <select
              value={priceQualifier}
              onChange={(event) => setPriceQualifier(event.target.value)}
            >
              {priceQualifierOptions.map((option) => (
                <option key={option} value={option}>
                  {option.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>

          <label>
            {copy.unit}
            <select value={priceUnit} onChange={(event) => setPriceUnit(event.target.value)}>
              {priceUnitOptions.map((option) => (
                <option key={option} value={option}>
                  {option.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>

          {isListing ? (
            <>
              <label>
                {copy.beds}
                <input value={beds} onChange={(event) => setBeds(event.target.value)} />
              </label>

              <label>
                {copy.baths}
                <input value={baths} onChange={(event) => setBaths(event.target.value)} />
              </label>

              <label>
                {copy.sqm}
                <input value={sqm} onChange={(event) => setSqm(event.target.value)} />
              </label>

              <label className="owner-edit-modal__full">
                {copy.image}
                <input value={image} onChange={(event) => setImage(event.target.value)} />
              </label>

              <label className="owner-edit-modal__full">
                {copy.floorPlan}
                <input
                  value={floorPlanUrl}
                  onChange={(event) => setFloorPlanUrl(event.target.value)}
                />
              </label>
            </>
          ) : null}

          {isActivity ? (
            <>
              <label>
                {copy.capacity}
                <input
                  inputMode="numeric"
                  value={capacity}
                  onChange={(event) => setCapacity(event.target.value)}
                />
              </label>

              <label>
                {copy.travelRegion}
                <select
                  value={travelRegion}
                  onChange={(event) =>
                    setTravelRegion(event.target.value as 'INSIDE_OMAN' | 'OUTSIDE_OMAN')
                  }
                >
                  {travelRegionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                {copy.startTime}
                <input
                  type="time"
                  value={availabilityStartTime}
                  onChange={(event) => setAvailabilityStartTime(event.target.value)}
                />
              </label>

              <label>
                {copy.endTime}
                <input
                  type="time"
                  value={availabilityEndTime}
                  onChange={(event) => setAvailabilityEndTime(event.target.value)}
                />
              </label>

              <div className="owner-edit-modal__full">
                <span>{copy.availabilityDays}</span>
                <div className="owner-edit-modal__days">
                  {dayOptions.map((day) => (
                    <button
                      className={availabilityDays.includes(day) ? 'active' : ''}
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          <label className="owner-edit-modal__full">
            {copy.video}
            <input
              value={videoWalkthroughUrl}
              onChange={(event) => setVideoWalkthroughUrl(event.target.value)}
            />
          </label>

          <label className="owner-edit-modal__full">
            {copy.tour360}
            <input value={tour360Url} onChange={(event) => setTour360Url(event.target.value)} />
          </label>

          <label className="owner-edit-modal__full">
            {copy.virtualTour}
            <input
              value={virtualTourUrl}
              onChange={(event) => setVirtualTourUrl(event.target.value)}
            />
          </label>
        </div>

        <div className="owner-edit-modal__actions">
          <button
            className="button-link button-link--secondary"
            type="button"
            onClick={onClose}
          >
            {copy.close}
          </button>

          <button
            className="button-link"
            type="button"
            disabled={saving}
            onClick={() => void handleSubmit()}
          >
            {saving ? copy.saving : copy.save}
          </button>
        </div>

        {statusMessage ? (
          <p className="form-success" role="status">
            {statusMessage}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
