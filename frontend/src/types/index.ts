export type Language = 'en' | 'ar';

export type DayName =
  | 'Sunday'
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday';

export type UserRole = 'USER' | 'OWNER' | 'ACTIVITY_PROVIDER' | 'DEVELOPER' | 'ADMIN';

export type ListingTransaction = 'Sale' | 'Rent' | 'Short stay';

export type ListingStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ActivityStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type InquiryType =
  | 'PROPERTY'
  | 'ACTIVITY'
  | 'DEVELOPER_PARTNERSHIP'
  | 'OWNER_PARTNERSHIP'
  | 'GENERAL';

export type ListingFurnishing =
  | 'Not specified'
  | 'Furnished'
  | 'Semi-furnished'
  | 'Unfurnished';

export type ListingView =
  | 'Not specified'
  | 'Sea view'
  | 'Mountain view'
  | 'City view'
  | 'Garden view'
  | 'Golf view';

export type PaymentFrequency =
  | 'Not specified'
  | 'Per night'
  | 'Per month'
  | 'Per year'
  | 'Total sale price';

export type LandmarkCategory =
  | 'Mall'
  | 'Landmark'
  | 'Beach'
  | 'Airport'
  | 'University'
  | 'Heritage'
  | 'Waterfront'
  | 'Development area'
  | 'Residential'
  | string;

/**
 * UI types used by the current frontend components.
 * Keep these stable until pages are migrated to API data.
 */

export type Landmark = {
  id: string;
  slug: string;
  name: string;
  city: string;
  category: LandmarkCategory;
};

export type DevelopmentCompany = {
  id: string;
  slug: string;
  name: string;
  logo: string;
  description: string;
  headquarters: string;
  location: string;
  phone?: string;
  email?: string;
  website?: string;
  verified: boolean;
  featured?: boolean;
  listedPropertyIds: string[];
  featuredProjectIds: string[];
  specialties: string[];
  establishedYear?: number;
};

export type TravelAgency = {
  id: string;
  slug: string;
  name: string;
  logo: string;
  description: string;
  headquarters: string;
  location: string;
  phone?: string;
  email?: string;
  website?: string;
  verified: boolean;
  featured?: boolean;
  activityIds: string[];
  specialties: string[];
  establishedYear?: number;
};

export type ListingDeveloperSummary = {
  id: string;
  slug: string;
  name: string;
  logo: string;
  verified: boolean;
  shortDescription: string;
};

export type ActivityTravelAgencySummary = {
  id: string;
  slug: string;
  name: string;
  logo: string;
  verified: boolean;
  shortDescription: string;
};

export type Listing = {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: string;
  transaction: ListingTransaction;
  location: string;
  price: string;
  beds: number;
  baths: number;
  sqm: number;
  image: string;
  status?: ListingStatus;
  amenities: string[];
  featured?: boolean;

  developerId?: string;
  developer?: ListingDeveloperSummary;
  developerName?: string;

  nearestLandmarkId?: string;
  nearestLandmarkName?: string;
  distanceFromLandmark?: string;

  maxGuests?: number;
  minStayNights?: number;
  parkingSpaces?: number;
  floorNumber?: number;
  furnishing?: ListingFurnishing;
  view?: ListingView;
  paymentFrequency?: PaymentFrequency;
};

export type ActivityDurationType = 'Short' | 'Half day' | 'Full day' | 'Overnight';

export type ActivityType = 'Private' | 'Group' | 'Both';

export type ActivityDifficulty = 'Easy' | 'Moderate' | 'Challenging';

export type ActivityAvailability = {
  days: DayName[];
  startTime: string;
  endTime: string;
};

export type ActivitySpecs = {
  durationType: ActivityDurationType;
  experienceType: ActivityType;
  familyFriendly: boolean;
  includesTransfer: boolean;
  mealIncluded: boolean;
  outdoor: boolean;
};

export type Activity = {
  id: string;
  slug: string;
  title: string;
  description: string;
  location: string;
  duration: string;
  durationMinutes: number;
  price: string;
  image: string;
  category: string;
  highlights: string[];
  availability: ActivityAvailability;
  specs: ActivitySpecs;
  featured?: boolean;
  status?: ActivityStatus;

  provider?: string;

  travelAgencyId?: string;
  travelAgency?: ActivityTravelAgencySummary;

  groupSize?: string;
  difficulty?: ActivityDifficulty;
  language?: string;
  nearestLandmarkId?: string;
  nearestLandmarkName?: string;
};

/**
 * Raw API response types from the backend.
 * These should be converted into the UI types above using mappers.
 */

export type ApiPagination = {
  take: number;
  skip: number;
  count: number;
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role?: UserRole | string;
  phone?: string | null;
};

export type ApiLandmark = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr?: string | null;
  cityEn: string;
  cityAr?: string | null;
  category: LandmarkCategory;
  createdAt?: string;
  updatedAt?: string;
};

export type ApiDeveloperCompany = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr?: string | null;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  headquartersEn?: string | null;
  headquartersAr?: string | null;
  logo?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  establishedYear?: number | null;
  verified: boolean;
  featured: boolean;
  _count?: {
    listings: number;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type ApiTravelAgency = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr?: string | null;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  headquartersEn?: string | null;
  headquartersAr?: string | null;
  logo?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  establishedYear?: number | null;
  verified: boolean;
  featured: boolean;
  _count?: {
    activities: number;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type ApiListingAmenity = {
  id?: string;
  name: string;
  nameEn?: string | null;
  nameAr?: string | null;
  listingId?: string;
};

export type ApiListingImage = {
  id?: string;
  url: string;
  altEn?: string | null;
  altAr?: string | null;
  sortOrder?: number;
  listingId?: string;
};

export type ApiListing = {
  id: string;
  slug: string;

  title: string;
  description: string;
  type: string;
  transaction: ListingTransaction | string;
  location: string;

  titleEn?: string | null;
  titleAr?: string | null;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  locationEn?: string | null;
  locationAr?: string | null;
  typeEn?: string | null;
  typeAr?: string | null;

  price: string;
  beds: number;
  baths: number;
  sqm: number;
  image: string;
  status?: ListingStatus;
  rejectedReason?: string | null;

  ownerId?: string;
  owner?: PublicUser;

  developerId?: string | null;
  developer?: ApiDeveloperCompany | null;
  developerNameEn?: string | null;
  developerNameAr?: string | null;

  nearestLandmarkId?: string | null;
  nearestLandmark?: ApiLandmark | null;
  distanceFromLandmarkEn?: string | null;
  distanceFromLandmarkAr?: string | null;

  amenities?: ApiListingAmenity[];
  images?: ApiListingImage[];

  maxGuests?: number | null;
  minStayNights?: number | null;
  parking?: boolean | null;
  floor?: number | null;
  furnishing?: string | null;
  view?: string | null;
  paymentFrequency?: string | null;

  createdAt?: string;
  updatedAt?: string;
};

export type ApiActivityImage = {
  id?: string;
  url: string;
  altEn?: string | null;
  altAr?: string | null;
  sortOrder?: number;
  activityId?: string;
};

export type ApiActivityHighlight = {
  id?: string;
  textEn: string;
  textAr?: string | null;
  activityId?: string;
};

export type ApiActivity = {
  id: string;
  slug: string;

  titleEn: string;
  titleAr?: string | null;
  descriptionEn: string;
  descriptionAr?: string | null;
  locationEn: string;
  locationAr?: string | null;

  categoryEn: string;
  categoryAr?: string | null;
  providerEn?: string | null;
  providerAr?: string | null;

  price: string;
  durationMinutes?: number | null;
durationLabelEn?: string | null;
durationLabelAr?: string | null;
durationType?: ActivityDurationType | string | null;
groupSize?: string | null;
  language?: string | null;
  difficulty?: ActivityDifficulty | string | null;
  activityType?: ActivityType | string | null;
  availabilityDays?: DayName[] | null;
availabilityStartTime?: string | null;
availabilityEndTime?: string | null;

  familyFriendly: boolean;
  includesTransfer: boolean;
  mealIncluded: boolean;
  outdoor: boolean;

  status?: ActivityStatus;
  rejectedReason?: string | null;
  

  ownerId?: string;
  owner?: PublicUser;

  travelAgencyId?: string | null;
  travelAgency?: ApiTravelAgency | null;

  nearestLandmarkId?: string | null;
  nearestLandmark?: ApiLandmark | null;
  distanceFromLandmarkEn?: string | null;
  distanceFromLandmarkAr?: string | null;

  images?: ApiActivityImage[];
  highlights?: ApiActivityHighlight[];

  createdAt?: string;
  updatedAt?: string;
};

export type Inquiry = {
  id: string;
  type: InquiryType;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  userId?: string | null;
  listingId?: string | null;
  activityId?: string | null;
  user?: PublicUser | null;
  listing?: Partial<ApiListing> | null;
  activity?: Partial<ApiActivity> | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiListResponse<T, K extends string> = {
  pagination: ApiPagination;
} & Record<K, T[]>;

/**
 * Temporary internal aliases.
 * User-facing UI must still say Activity / Activities everywhere.
 */
export type ExperienceDurationType = ActivityDurationType;
export type ExperienceType = ActivityType;
export type ExperienceDifficulty = ActivityDifficulty;
export type ExperienceAvailability = ActivityAvailability;
export type ExperienceSpecs = ActivitySpecs;
export type Experience = Activity;

export type MarketplaceStats = {
  listings: number;
  activities: number;
  developers: number;
  verifiedPartners: number;
};

export type ContactFormState = {
  name: string;
  email: string;
  phone: string;
  message: string;
};