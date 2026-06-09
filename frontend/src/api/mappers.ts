import type {
  Activity,
  ActivityDifficulty,
  ActivityType,
  ApiActivity,
  ApiDeveloperCompany,
  ApiLandmark,
  ApiListing,
  DevelopmentCompany,
  Landmark,
  Language,
  Listing,
  ListingFurnishing,
  ListingTransaction,
  ListingView,
  PaymentFrequency
} from '../types';

function pickLocalized(
  language: Language,
  english?: string | null,
  arabic?: string | null,
  fallback = ''
) {
  if (language === 'ar') {
    return arabic || english || fallback;
  }

  return english || arabic || fallback;
}

function asListingTransaction(value: string): ListingTransaction {
  if (value === 'Sale' || value === 'Rent' || value === 'Short stay') {
    return value;
  }

  return 'Sale';
}

function asListingFurnishing(value?: string | null): ListingFurnishing | undefined {
  if (
    value === 'Not specified' ||
    value === 'Furnished' ||
    value === 'Semi-furnished' ||
    value === 'Unfurnished'
  ) {
    return value;
  }

  return undefined;
}

function asListingView(value?: string | null): ListingView | undefined {
  if (
    value === 'Not specified' ||
    value === 'Sea view' ||
    value === 'Mountain view' ||
    value === 'City view' ||
    value === 'Garden view' ||
    value === 'Golf view'
  ) {
    return value;
  }

  return undefined;
}

function asPaymentFrequency(value?: string | null): PaymentFrequency | undefined {
  if (
    value === 'Not specified' ||
    value === 'Per night' ||
    value === 'Per month' ||
    value === 'Per year' ||
    value === 'Total sale price'
  ) {
    return value;
  }

  return undefined;
}

function asActivityType(value?: string | null): ActivityType {
  if (value === 'Private' || value === 'Group' || value === 'Both') {
    return value;
  }

  return 'Private';
}

function asActivityDifficulty(value?: string | null): ActivityDifficulty | undefined {
  if (value === 'Easy' || value === 'Moderate' || value === 'Challenging') {
    return value;
  }

  return undefined;
}

export function mapLandmark(apiLandmark: ApiLandmark, language: Language): Landmark {
  return {
    id: apiLandmark.id,
    slug: apiLandmark.slug,
    name: pickLocalized(language, apiLandmark.nameEn, apiLandmark.nameAr),
    city: pickLocalized(language, apiLandmark.cityEn, apiLandmark.cityAr),
    category: apiLandmark.category
  };
}

export function mapDeveloperCompany(
  apiDeveloper: ApiDeveloperCompany,
  language: Language
): DevelopmentCompany {
  const name = pickLocalized(language, apiDeveloper.nameEn, apiDeveloper.nameAr);
  const description = pickLocalized(
    language,
    apiDeveloper.descriptionEn,
    apiDeveloper.descriptionAr
  );
  const headquarters = pickLocalized(
    language,
    apiDeveloper.headquartersEn,
    apiDeveloper.headquartersAr
  );

  return {
    id: apiDeveloper.id,
    slug: apiDeveloper.slug,
    name,
    logo: apiDeveloper.logo || '',
    description,
    headquarters,
    location: headquarters,
    phone: apiDeveloper.phone || undefined,
    email: apiDeveloper.email || undefined,
    website: apiDeveloper.website || undefined,
    verified: apiDeveloper.verified,
    featured: apiDeveloper.featured,
    listedPropertyIds: [],
    featuredProjectIds: [],
    specialties: [],
    establishedYear: apiDeveloper.establishedYear ?? undefined
  };
}

export function mapListing(apiListing: ApiListing, language: Language): Listing {
  const developer = apiListing.developer
    ? {
        id: apiListing.developer.id,
        slug: apiListing.developer.slug,
        name: pickLocalized(language, apiListing.developer.nameEn, apiListing.developer.nameAr),
        logo: apiListing.developer.logo || '',
        verified: apiListing.developer.verified,
        shortDescription: pickLocalized(
          language,
          apiListing.developer.descriptionEn,
          apiListing.developer.descriptionAr
        )
      }
    : undefined;

  const nearestLandmark = apiListing.nearestLandmark
    ? mapLandmark(apiListing.nearestLandmark, language)
    : undefined;

  const firstImage = apiListing.images?.[0]?.url;

  return {
    id: apiListing.id,
    slug: apiListing.slug,
    title: pickLocalized(language, apiListing.titleEn, apiListing.titleAr, apiListing.title),
    description: pickLocalized(
      language,
      apiListing.descriptionEn,
      apiListing.descriptionAr,
      apiListing.description
    ),
    type: pickLocalized(language, apiListing.typeEn, apiListing.typeAr, apiListing.type),
    transaction: asListingTransaction(apiListing.transaction),
    location: pickLocalized(
      language,
      apiListing.locationEn,
      apiListing.locationAr,
      apiListing.location
    ),
    price: apiListing.price,
    beds: apiListing.beds,
    baths: apiListing.baths,
    sqm: apiListing.sqm,
    image: firstImage || apiListing.image,
    status: apiListing.status,
    amenities:
      apiListing.amenities?.map((amenity) =>
        pickLocalized(language, amenity.nameEn, amenity.nameAr, amenity.name)
      ) ?? [],
    featured: apiListing.featured,
    developerId: apiListing.developerId ?? undefined,
    developer,
    nearestLandmarkId: apiListing.nearestLandmarkId ?? undefined,
    nearestLandmarkName: nearestLandmark?.name,
    distanceFromLandmark: pickLocalized(
      language,
      apiListing.distanceFromLandmarkEn,
      apiListing.distanceFromLandmarkAr
    ),
    maxGuests: apiListing.maxGuests ?? undefined,
    minStayNights: apiListing.minStayNights ?? undefined,
    parkingSpaces: apiListing.parking ? 1 : undefined,
    floorNumber: apiListing.floor ?? undefined,
    furnishing: asListingFurnishing(apiListing.furnishing),
    view: asListingView(apiListing.view),
    paymentFrequency: asPaymentFrequency(apiListing.paymentFrequency)
  };
}

export function mapActivity(apiActivity: ApiActivity, language: Language): Activity {
  const nearestLandmark = apiActivity.nearestLandmark
    ? mapLandmark(apiActivity.nearestLandmark, language)
    : undefined;

  const firstImage = apiActivity.images?.[0]?.url ?? '';

  const duration =
    pickLocalized(language, apiActivity.durationLabelEn, apiActivity.durationLabelAr) ||
    (apiActivity.durationMinutes ? `${apiActivity.durationMinutes} min` : '');

  return {
    id: apiActivity.id,
    slug: apiActivity.slug,
    title: pickLocalized(language, apiActivity.titleEn, apiActivity.titleAr),
    description: pickLocalized(language, apiActivity.descriptionEn, apiActivity.descriptionAr),
    location: pickLocalized(language, apiActivity.locationEn, apiActivity.locationAr),
    duration,
    durationMinutes: apiActivity.durationMinutes ?? 0,
    price: apiActivity.price,
    image: firstImage,
    category: pickLocalized(language, apiActivity.categoryEn, apiActivity.categoryAr),
    highlights:
      apiActivity.highlights?.map((highlight) =>
        pickLocalized(language, highlight.textEn, highlight.textAr)
      ) ?? [],
    availability: {
      days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      startTime: '09:00',
      endTime: '18:00'
    },
    specs: {
      durationType: 'Short',
      experienceType: asActivityType(apiActivity.activityType),
      familyFriendly: apiActivity.familyFriendly,
      includesTransfer: apiActivity.includesTransfer,
      mealIncluded: apiActivity.mealIncluded,
      outdoor: apiActivity.outdoor
    },
    featured: apiActivity.featured,
    provider: pickLocalized(language, apiActivity.providerEn, apiActivity.providerAr),
    groupSize: apiActivity.groupSize ?? undefined,
    difficulty: asActivityDifficulty(apiActivity.difficulty),
    language: apiActivity.language ?? undefined,
    nearestLandmarkId: apiActivity.nearestLandmarkId ?? undefined,
    nearestLandmarkName: nearestLandmark?.name
  };
}