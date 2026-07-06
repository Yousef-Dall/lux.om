export type Language = 'en' | 'ar';

export type DayName =
| 'Sunday'
| 'Monday'
| 'Tuesday'
| 'Wednesday'
| 'Thursday'
| 'Friday'
| 'Saturday';

export type UserRole =
| 'USER'
| 'OWNER'
| 'ACTIVITY_PROVIDER'
| 'TRAVEL_AGENCY'
| 'DEVELOPER'
| 'ADMIN';

export type ListingTransaction = 'Sale' | 'Rent' | 'Short stay';

export type ListingBuyerEligibility =
| 'OMANI_ONLY'
| 'GCC_NATIONALS'
| 'OMAN_RESIDENTS'
| 'FOREIGNERS_ALLOWED'
| 'COMPANY_PURCHASE_ALLOWED'
| 'FREEHOLD'
| 'USUFRUCT'
| 'EXPAT_BUYABLE'
| 'ITC'
| 'GOLDEN_VISA_ELIGIBLE'
| 'OMR_250K_RESIDENCY_ELIGIBLE'
| 'OMR_500K_RESIDENCY_ELIGIBLE';

export type ListingStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type DeveloperProjectStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ActivityStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ActivityTravelRegion = 'INSIDE_OMAN' | 'OUTSIDE_OMAN';

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

export type PriceQualifier =
| 'FIXED'
| 'FROM'
| 'ON_REQUEST';

export type PriceUnit =
| 'TOTAL'
| 'NIGHT'
| 'MONTH'
| 'YEAR'
| 'PERSON'
| 'GROUP'
| 'HOUR'
| 'DAY'
| 'ACTIVITY';

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
verificationStatus?: VerificationStatus | null;
verificationSource?: string | null;
verificationNotes?: string | null;
verificationDate?: string | null;
verificationExpiryDate?: string | null;
listedPropertyIds: string[];
featuredProjectIds: string[];
specialties: string[];
establishedYear?: number;
};

export type DeveloperProjectImage = {
id?: string;
url: string;
altEn?: string | null;
altAr?: string | null;
sortOrder?: number;
projectId?: string;
};

export type DeveloperProjectSummary = {
id: string;
slug: string;
name: string;
location: string;
image?: string;
status?: DeveloperProjectStatus;
};

export type DeveloperProject = {
id: string;
slug: string;
name: string;
description: string;
location: string;
completionStatus?: string;
handoverDate?: string;
totalUnits?: number;
availableUnits?: number;
bedroomsSummary?: string;
amenities: string[];
paymentPlan?: string;
brochureUrl?: string;
masterplanUrl?: string;
videoWalkthroughUrl?: string;
image?: string;
images?: DeveloperProjectImage[];
mediaQualityStatus?: MediaQualityStatus | null;
mediaQualityNotes?: string | null;
enhancedImageUrl?: string | null;
enhancementStatus?: EnhancementStatus | null;
enhancementProvider?: string | null;
enhancementNotes?: string | null;
startingPriceAmount?: string;
priceCurrency?: string;
priceQualifier?: PriceQualifier;
status?: DeveloperProjectStatus;
rejectedReason?: string;
developerId: string;
developer?: DevelopmentCompany;
owner?: PublicUser;
nearestLandmarkId?: string;
nearestLandmarkName?: string;
units?: Listing[];
unitCount?: number;
createdAt?: string;
updatedAt?: string;
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
verificationStatus?: VerificationStatus | null;
verificationSource?: string | null;
verificationNotes?: string | null;
verificationDate?: string | null;
verificationExpiryDate?: string | null;
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
phone?: string | null;
email?: string | null;
verificationStatus?: VerificationStatus | null;
shortDescription: string;
};

export type ActivityTravelAgencySummary = {
id: string;
slug: string;
name: string;
logo: string;
verified: boolean;
phone?: string | null;
email?: string | null;
verificationStatus?: VerificationStatus | null;
shortDescription: string;
};

export type Listing = {
id: string;
slug: string;
title: string;
description: string;
type: string;
transaction: ListingTransaction;
buyerEligibility?: ListingBuyerEligibility[];
location: string;
price: string;
priceAmount?: string;
priceCurrency?: string;
priceQualifier?: PriceQualifier;
priceUnit?: PriceUnit;
beds: number;
baths: number;
sqm: number;
image: string;
images?: ApiListingImage[];
premiumMedia?: PremiumMediaAsset[];
videoWalkthroughUrl?: string;
tour360Url?: string;
virtualTourUrl?: string;
floorPlanUrl?: string;
mediaQualityStatus?: MediaQualityStatus;
mediaQualityNotes?: string;
enhancedImageUrl?: string;
enhancementStatus?: EnhancementStatus;
enhancementNotes?: string;
verificationStatus?: VerificationStatus;
verificationSource?: string;
verificationNotes?: string;
eligibilityNotes?: string;
eligibilityDisclaimer?: string;
investorHighlights?: string[];
owner?: PublicUser;
status?: ListingStatus;
amenities: string[];
featured?: boolean;

developerId?: string;
developer?: ListingDeveloperSummary;
developerName?: string;
developerProjectId?: string;
developerProject?: DeveloperProjectSummary;

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
priceAmount?: string;
priceCurrency?: string;
priceQualifier?: PriceQualifier;
priceUnit?: PriceUnit;
image: string;
images?: ApiActivityImage[];
premiumMedia?: PremiumMediaAsset[];
videoWalkthroughUrl?: string;
tour360Url?: string;
virtualTourUrl?: string;
mediaQualityStatus?: MediaQualityStatus;
mediaQualityNotes?: string;
enhancedImageUrl?: string;
enhancementStatus?: EnhancementStatus;
enhancementNotes?: string;
verificationStatus?: VerificationStatus;
verificationSource?: string;
verificationNotes?: string;
owner?: PublicUser;
category: string;
highlights: string[];
availability: ActivityAvailability;
specs: ActivitySpecs;
featured?: boolean;
status?: ActivityStatus;
travelRegion?: ActivityTravelRegion;

destinationCountry?: string;
destinationCity?: string;
departureCity?: string;

tripDurationDays?: number;
tripDurationNights?: number;

flightIncluded?: boolean;
airline?: string;
flightNotes?: string;

hotelIncluded?: boolean;
hotelName?: string;
hotelRating?: number;
roomType?: string;
mealPlan?: string;

visaSupportIncluded?: boolean;
travelInsuranceIncluded?: boolean;
airportTransferIncluded?: boolean;

packageItinerary?: string;
requiredDocuments?: string;
cancellationPolicy?: string;
availableTravelDates?: string;
minimumGroupSize?: number;
packageInclusions?: string;
packageExclusions?: string;

provider?: string;

travelAgencyId?: string;
travelAgency?: ActivityTravelAgencySummary;

groupSize?: string;
capacity?: number;
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
companyName?: string | null;
emailVerified?: boolean;
emailVerifiedAt?: string | null;
emailBookingUpdates?: boolean;
emailSavedSearchUpdates?: boolean;
emailMarketingUpdates?: boolean;
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
verificationStatus?: VerificationStatus | null;
verificationSource?: string | null;
verificationNotes?: string | null;
verificationDate?: string | null;
verificationExpiryDate?: string | null;
_count?: {
listings: number;
projects?: number;
};
createdAt?: string;
updatedAt?: string;
};

export type ApiDeveloperProjectImage = {
id?: string;
url: string;
altEn?: string | null;
altAr?: string | null;
sortOrder?: number;
projectId?: string;
};

export type ApiDeveloperProject = {
id: string;
slug: string;
nameEn: string;
nameAr?: string | null;
descriptionEn?: string | null;
descriptionAr?: string | null;
locationEn: string;
locationAr?: string | null;
completionStatus?: string | null;
handoverDate?: string | null;
totalUnits?: number | null;
availableUnits?: number | null;
bedroomsSummary?: string | null;
amenities?: string[] | null;
paymentPlan?: string | null;
brochureUrl?: string | null;
masterplanUrl?: string | null;
videoWalkthroughUrl?: string | null;
image?: string | null;
images?: ApiDeveloperProjectImage[];
mediaQualityStatus?: MediaQualityStatus | null;
mediaQualityNotes?: string | null;
enhancedImageUrl?: string | null;
enhancementStatus?: EnhancementStatus | null;
enhancementProvider?: string | null;
enhancementNotes?: string | null;
startingPriceAmount?: string | null;
priceCurrency?: string | null;
priceQualifier?: PriceQualifier | null;
status?: DeveloperProjectStatus;
rejectedReason?: string | null;
developerId: string;
developer?: ApiDeveloperCompany | null;
owner?: PublicUser;
nearestLandmarkId?: string | null;
nearestLandmark?: ApiLandmark | null;
listings?: ApiListing[];
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
verificationStatus?: VerificationStatus | null;
verificationSource?: string | null;
verificationNotes?: string | null;
verificationDate?: string | null;
verificationExpiryDate?: string | null;
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
buyerEligibility?: ListingBuyerEligibility[] | null;
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
priceAmount?: string | null;
priceCurrency?: string | null;
priceQualifier?: PriceQualifier | null;
priceUnit?: PriceUnit | null;
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
developerProjectId?: string | null;
developerProject?: ApiDeveloperProject | null;

nearestLandmarkId?: string | null;
nearestLandmark?: ApiLandmark | null;
distanceFromLandmarkEn?: string | null;
distanceFromLandmarkAr?: string | null;

amenities?: ApiListingAmenity[];
images?: ApiListingImage[];
premiumMedia?: PremiumMediaAsset[];
videoWalkthroughUrl?: string | null;
tour360Url?: string | null;
virtualTourUrl?: string | null;
floorPlanUrl?: string | null;
mediaQualityStatus?: MediaQualityStatus | null;
mediaQualityNotes?: string | null;
enhancedImageUrl?: string | null;
enhancementStatus?: EnhancementStatus | null;
enhancementProvider?: string | null;
enhancementNotes?: string | null;
verificationStatus?: VerificationStatus | null;
verificationSource?: string | null;
verificationNotes?: string | null;
eligibilityNotes?: string | null;
eligibilityDisclaimer?: string | null;
adminVerificationNotes?: string | null;
investorHighlights?: string[] | null;
eligibilityMarkedBy?: PublicUser | null;
verificationReviewedBy?: PublicUser | null;

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
priceAmount?: string | null;
priceCurrency?: string | null;
priceQualifier?: PriceQualifier | null;
priceUnit?: PriceUnit | null;

durationMinutes?: number | null;
durationLabelEn?: string | null;
durationLabelAr?: string | null;
durationType?: ActivityDurationType | string | null;
groupSize?: string | null;
capacity?: number | null;
language?: string | null;
difficulty?: ActivityDifficulty | string | null;
activityType?: ActivityType | string | null;
travelRegion?: ActivityTravelRegion | null;

destinationCountry?: string | null;
destinationCity?: string | null;
departureCity?: string | null;

tripDurationDays?: number | null;
tripDurationNights?: number | null;

flightIncluded?: boolean | null;
airline?: string | null;
flightNotes?: string | null;

hotelIncluded?: boolean | null;
hotelName?: string | null;
hotelRating?: number | null;
roomType?: string | null;
mealPlan?: string | null;

visaSupportIncluded?: boolean | null;
travelInsuranceIncluded?: boolean | null;
airportTransferIncluded?: boolean | null;

packageItinerary?: string | null;
requiredDocuments?: string | null;
cancellationPolicy?: string | null;
availableTravelDates?: string | null;
minimumGroupSize?: number | null;
packageInclusions?: string | null;
packageExclusions?: string | null;

availabilityDays?: DayName[] | null;
availabilityStartTime?: string | null;
availabilityEndTime?: string | null;

familyFriendly: boolean;
includesTransfer: boolean;
mealIncluded: boolean;
outdoor: boolean;

videoWalkthroughUrl?: string | null;
tour360Url?: string | null;
virtualTourUrl?: string | null;
premiumMedia?: PremiumMediaAsset[];
mediaQualityStatus?: MediaQualityStatus | null;
mediaQualityNotes?: string | null;
enhancedImageUrl?: string | null;
enhancementStatus?: EnhancementStatus | null;
enhancementProvider?: string | null;
enhancementNotes?: string | null;
verificationStatus?: VerificationStatus | null;
verificationSource?: string | null;
verificationNotes?: string | null;
verificationReviewedBy?: PublicUser | null;

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


export type MediaAssetType =
| 'IMAGE'
| 'VIDEO_WALKTHROUGH'
| 'TOUR_360'
| 'VIRTUAL_TOUR'
| 'FLOOR_PLAN'
| 'DOCUMENT'
| 'OTHER';

export type MediaQualityStatus =
| 'NOT_CHECKED'
| 'NEEDS_REVIEW'
| 'ACCEPTABLE'
| 'EXCELLENT'
| 'BLOCKED';

export type EnhancementStatus =
| 'NOT_REQUESTED'
| 'NOT_CONFIGURED'
| 'QUEUED'
| 'PROCESSING'
| 'COMPLETED'
| 'FAILED';

export type VerificationSource =
  | 'LUX_OM_ADMIN_REVIEW'
  | 'OWNER_DOCUMENT_SUBMISSION'
  | 'FUTURE_MOLUP_API'
  | 'FUTURE_MUNICIPALITY_REGISTRATION'
  | 'FUTURE_THIRD_PARTY_PROVIDER';

export type VerificationStatus =
| 'UNVERIFIED'
| 'SUBMITTED'
| 'ADMIN_VERIFIED'
| 'EXTERNALLY_VERIFIED'
| 'REJECTED'
| 'EXPIRED';

export type PremiumMediaAsset = {
id: string;
type: MediaAssetType;
url: string;
provider?: string | null;
titleEn?: string | null;
titleAr?: string | null;
altEn?: string | null;
altAr?: string | null;
sortOrder: number;
isPrimary: boolean;
};

export type MarketInsight = {
id?: string;
location: string;
locationKey: string;
propertyType?: string | null;
sampleSizeSale: number;
sampleSizeRent: number;
avgAskingPrice?: string | number | null;
avgRent?: string | number | null;
avgPricePerSqm?: string | number | null;
estimatedRentalYield?: string | number | null;
notEnoughData: boolean;
notes: string;
generatedAt?: string;
};
