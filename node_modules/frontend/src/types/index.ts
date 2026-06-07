export type DayName =
  | 'Sunday'
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday';

export type ListingTransaction = 'Sale' | 'Rent' | 'Short stay';

export type ListingStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

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
  | 'Development area';

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

export type ListingDeveloperSummary = {
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

  provider?: string;
  groupSize?: string;
  difficulty?: ActivityDifficulty;
  language?: string;
  nearestLandmarkId?: string;
  nearestLandmarkName?: string;
};

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