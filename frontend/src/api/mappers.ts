import { resolveAssetUrl } from './assets';

import type {
Activity,
ActivityDifficulty,
ActivityType,
ApiActivity,
ApiDeveloperCompany,
ApiDeveloperProject,
ApiLandmark,
ApiListing,
ApiTravelAgency,
DevelopmentCompany,
DeveloperProject,
Landmark,
Language,
Listing,
ListingFurnishing,
ListingTransaction,
ListingView,
PaymentFrequency,
TravelAgency
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

function asActivityDurationType(value?: string | null) {
if (
value === 'Short' ||
value === 'Half day' ||
value === 'Full day' ||
value === 'Overnight'
) {
return value;
}

return 'Short';
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
logo: resolveAssetUrl(apiDeveloper.logo),
description,
headquarters,
location: headquarters,
phone: apiDeveloper.phone || undefined,
email: apiDeveloper.email || undefined,
website: apiDeveloper.website || undefined,
verified: apiDeveloper.verified,
featured: apiDeveloper.featured,
verificationStatus: apiDeveloper.verificationStatus ?? null,
verificationSource: apiDeveloper.verificationSource ?? null,
verificationNotes: apiDeveloper.verificationNotes ?? null,
verificationDate: apiDeveloper.verificationDate ?? null,
verificationExpiryDate: apiDeveloper.verificationExpiryDate ?? null,
listedPropertyIds: [],
featuredProjectIds: [],
listingCount: apiDeveloper._count?.listings ?? 0,
projectCount: apiDeveloper._count?.projects ?? 0,
specialties: [],
establishedYear: apiDeveloper.establishedYear ?? undefined
};
}


export function mapDeveloperProject(
apiProject: ApiDeveloperProject,
language: Language
): DeveloperProject {
const name = pickLocalized(language, apiProject.nameEn, apiProject.nameAr);
const description = pickLocalized(
language,
apiProject.descriptionEn,
apiProject.descriptionAr
);
const location = pickLocalized(language, apiProject.locationEn, apiProject.locationAr);
const images =
apiProject.images
?.map((image) => ({
...image,
url: resolveAssetUrl(image.url)
}))
.filter((image) => image.url) ?? [];
const developer = apiProject.developer
? mapDeveloperCompany(apiProject.developer, language)
: undefined;
const nearestLandmark = apiProject.nearestLandmark
? mapLandmark(apiProject.nearestLandmark, language)
: undefined;

return {
id: apiProject.id,
slug: apiProject.slug,
name,
description,
location,
completionStatus: apiProject.completionStatus ?? undefined,
handoverDate: apiProject.handoverDate ?? undefined,
totalUnits: apiProject.totalUnits ?? undefined,
availableUnits: apiProject.availableUnits ?? undefined,
bedroomsSummary: apiProject.bedroomsSummary ?? undefined,
amenities: apiProject.amenities ?? [],
paymentPlan: apiProject.paymentPlan ?? undefined,
brochureUrl: apiProject.brochureUrl ? resolveAssetUrl(apiProject.brochureUrl) : undefined,
masterplanUrl: apiProject.masterplanUrl ? resolveAssetUrl(apiProject.masterplanUrl) : undefined,
videoWalkthroughUrl: apiProject.videoWalkthroughUrl ? resolveAssetUrl(apiProject.videoWalkthroughUrl) : undefined,
image: resolveAssetUrl(images[0]?.url || apiProject.image),
images,
mediaQualityStatus: apiProject.mediaQualityStatus ?? null,
mediaQualityNotes: apiProject.mediaQualityNotes ?? null,
enhancedImageUrl: apiProject.enhancedImageUrl ? resolveAssetUrl(apiProject.enhancedImageUrl) : null,
enhancementStatus: apiProject.enhancementStatus ?? null,
enhancementProvider: apiProject.enhancementProvider ?? null,
enhancementNotes: apiProject.enhancementNotes ?? null,
startingPriceAmount: apiProject.startingPriceAmount ?? undefined,
priceCurrency: apiProject.priceCurrency ?? undefined,
priceQualifier: apiProject.priceQualifier ?? undefined,
status: apiProject.status,
rejectedReason: apiProject.rejectedReason ?? undefined,
developerId: apiProject.developerId,
developer,
owner: apiProject.owner,
nearestLandmarkId: apiProject.nearestLandmarkId ?? undefined,
nearestLandmarkName: nearestLandmark?.name,
units: apiProject.listings?.map((listing) => mapListing(listing, language)) ?? [],
unitCount: apiProject._count?.listings ?? apiProject.listings?.length ?? 0,
createdAt: apiProject.createdAt,
updatedAt: apiProject.updatedAt
};
}

export function mapTravelAgency(
apiTravelAgency: ApiTravelAgency,
language: Language
): TravelAgency {
const name = pickLocalized(language, apiTravelAgency.nameEn, apiTravelAgency.nameAr);
const description = pickLocalized(
language,
apiTravelAgency.descriptionEn,
apiTravelAgency.descriptionAr
);
const headquarters = pickLocalized(
language,
apiTravelAgency.headquartersEn,
apiTravelAgency.headquartersAr
);

return {
id: apiTravelAgency.id,
slug: apiTravelAgency.slug,
name,
logo: resolveAssetUrl(apiTravelAgency.logo),
description,
headquarters,
location: headquarters,
phone: apiTravelAgency.phone || undefined,
email: apiTravelAgency.email || undefined,
website: apiTravelAgency.website || undefined,
verified: apiTravelAgency.verified,
featured: apiTravelAgency.featured,
verificationStatus: apiTravelAgency.verificationStatus ?? null,
verificationSource: apiTravelAgency.verificationSource ?? null,
verificationNotes: apiTravelAgency.verificationNotes ?? null,
verificationDate: apiTravelAgency.verificationDate ?? null,
verificationExpiryDate: apiTravelAgency.verificationExpiryDate ?? null,
activityIds: [],
activityCount: apiTravelAgency._count?.activities ?? 0,
specialties: [],
establishedYear: apiTravelAgency.establishedYear ?? undefined
};
}

export function mapListing(apiListing: ApiListing, language: Language): Listing {
const developer = apiListing.developer
? {
id: apiListing.developer.id,
slug: apiListing.developer.slug,
name: pickLocalized(language, apiListing.developer.nameEn, apiListing.developer.nameAr),
logo: resolveAssetUrl(apiListing.developer.logo),
verified: apiListing.developer.verified,
phone: apiListing.developer.phone,
email: apiListing.developer.email,
verificationStatus: apiListing.developer.verificationStatus,
shortDescription: pickLocalized(
language,
apiListing.developer.descriptionEn,
apiListing.developer.descriptionAr
)
}
: undefined;

const manualDeveloperName = pickLocalized(
language,
apiListing.developerNameEn,
apiListing.developerNameAr
);

const developerProject = apiListing.developerProject
? {
id: apiListing.developerProject.id,
slug: apiListing.developerProject.slug,
name: pickLocalized(language, apiListing.developerProject.nameEn, apiListing.developerProject.nameAr),
location: pickLocalized(language, apiListing.developerProject.locationEn, apiListing.developerProject.locationAr),
image: apiListing.developerProject.image ? resolveAssetUrl(apiListing.developerProject.image) : undefined,
status: apiListing.developerProject.status
}
: undefined;

const nearestLandmark = apiListing.nearestLandmark
? mapLandmark(apiListing.nearestLandmark, language)
: undefined;

const listingImages =
apiListing.images
?.map((image) => ({
...image,
url: resolveAssetUrl(image.url)
}))
.filter((image) => image.url) ?? [];

const listingPremiumMedia =
apiListing.premiumMedia
?.map((media) => ({
...media,
url: resolveAssetUrl(media.url)
}))
.filter((media) => media.url) ?? [];

const firstImage = listingImages[0]?.url || apiListing.image;

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
buyerEligibility: apiListing.buyerEligibility ?? [],
location: pickLocalized(
language,
apiListing.locationEn,
apiListing.locationAr,
apiListing.location
),
price: apiListing.price,
priceAmount: apiListing.priceAmount ?? undefined,
priceCurrency: apiListing.priceCurrency ?? undefined,
priceQualifier: apiListing.priceQualifier ?? undefined,
priceUnit: apiListing.priceUnit ?? undefined,
beds: apiListing.beds,
baths: apiListing.baths,
sqm: apiListing.sqm,
image: resolveAssetUrl(firstImage || apiListing.image),
images: listingImages,
premiumMedia: listingPremiumMedia,
videoWalkthroughUrl: apiListing.videoWalkthroughUrl ?? undefined,
tour360Url: apiListing.tour360Url ?? undefined,
virtualTourUrl: apiListing.virtualTourUrl ?? undefined,
floorPlanUrl: apiListing.floorPlanUrl ? resolveAssetUrl(apiListing.floorPlanUrl) : undefined,
mediaQualityStatus: apiListing.mediaQualityStatus ?? undefined,
mediaQualityNotes: apiListing.mediaQualityNotes ?? undefined,
enhancedImageUrl: apiListing.enhancedImageUrl ? resolveAssetUrl(apiListing.enhancedImageUrl) : undefined,
enhancementStatus: apiListing.enhancementStatus ?? undefined,
enhancementNotes: apiListing.enhancementNotes ?? undefined,
verificationStatus: apiListing.verificationStatus ?? undefined,
verificationSource: apiListing.verificationSource ?? undefined,
verificationNotes: apiListing.verificationNotes ?? undefined,
eligibilityNotes: apiListing.eligibilityNotes ?? undefined,
eligibilityDisclaimer: apiListing.eligibilityDisclaimer ?? undefined,
investorHighlights: apiListing.investorHighlights ?? [],
owner: apiListing.owner,
status: apiListing.status,
amenities:
apiListing.amenities?.map((amenity) =>
pickLocalized(language, amenity.nameEn, amenity.nameAr, amenity.name)
) ?? [],
featured: apiListing.developer?.featured === true,
developerId: apiListing.developerId ?? undefined,
developer,
developerName: manualDeveloperName || undefined,
developerProjectId: apiListing.developerProjectId ?? undefined,
developerProject,
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

const travelAgency = apiActivity.travelAgency
? {
id: apiActivity.travelAgency.id,
slug: apiActivity.travelAgency.slug,
name: pickLocalized(
language,
apiActivity.travelAgency.nameEn,
apiActivity.travelAgency.nameAr
),
logo: resolveAssetUrl(apiActivity.travelAgency.logo),
verified: apiActivity.travelAgency.verified,
phone: apiActivity.travelAgency.phone,
email: apiActivity.travelAgency.email,
verificationStatus: apiActivity.travelAgency.verificationStatus,
shortDescription: pickLocalized(
language,
apiActivity.travelAgency.descriptionEn,
apiActivity.travelAgency.descriptionAr
)
}
: undefined;

const activityImages =
apiActivity.images
?.map((image) => ({
...image,
url: resolveAssetUrl(image.url)
}))
.filter((image) => image.url) ?? [];

const activityPremiumMedia =
apiActivity.premiumMedia
?.map((media) => ({
...media,
url: resolveAssetUrl(media.url)
}))
.filter((media) => media.url) ?? [];

const firstImage = activityImages[0]?.url || '';

const duration =
pickLocalized(language, apiActivity.durationLabelEn, apiActivity.durationLabelAr) ||
(apiActivity.durationMinutes ? `${apiActivity.durationMinutes} min` : '');

const provider =
travelAgency?.name || pickLocalized(language, apiActivity.providerEn, apiActivity.providerAr);

return {
id: apiActivity.id,
slug: apiActivity.slug,
title: pickLocalized(language, apiActivity.titleEn, apiActivity.titleAr),
description: pickLocalized(language, apiActivity.descriptionEn, apiActivity.descriptionAr),
location: pickLocalized(language, apiActivity.locationEn, apiActivity.locationAr),
duration,
durationMinutes: apiActivity.durationMinutes ?? 0,
price: apiActivity.price,
priceAmount: apiActivity.priceAmount ?? undefined,
priceCurrency: apiActivity.priceCurrency ?? undefined,
priceQualifier: apiActivity.priceQualifier ?? undefined,
priceUnit: apiActivity.priceUnit ?? undefined,
image: resolveAssetUrl(firstImage),
images: activityImages,
premiumMedia: activityPremiumMedia,
videoWalkthroughUrl: apiActivity.videoWalkthroughUrl ?? undefined,
tour360Url: apiActivity.tour360Url ?? undefined,
virtualTourUrl: apiActivity.virtualTourUrl ?? undefined,
mediaQualityStatus: apiActivity.mediaQualityStatus ?? undefined,
mediaQualityNotes: apiActivity.mediaQualityNotes ?? undefined,
enhancedImageUrl: apiActivity.enhancedImageUrl ? resolveAssetUrl(apiActivity.enhancedImageUrl) : undefined,
enhancementStatus: apiActivity.enhancementStatus ?? undefined,
enhancementNotes: apiActivity.enhancementNotes ?? undefined,
verificationStatus: apiActivity.verificationStatus ?? undefined,
verificationSource: apiActivity.verificationSource ?? undefined,
verificationNotes: apiActivity.verificationNotes ?? undefined,
owner: apiActivity.owner,
category: pickLocalized(language, apiActivity.categoryEn, apiActivity.categoryAr),
highlights:
apiActivity.highlights?.map((highlight) =>
pickLocalized(language, highlight.textEn, highlight.textAr)
) ?? [],
availability: {
days:
apiActivity.availabilityDays && apiActivity.availabilityDays.length > 0
? apiActivity.availabilityDays
: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
startTime: apiActivity.availabilityStartTime ?? '09:00',
endTime: apiActivity.availabilityEndTime ?? '18:00'
},
status: apiActivity.status,
travelRegion: apiActivity.travelRegion ?? undefined,

destinationCountry: apiActivity.destinationCountry ?? undefined,
destinationCity: apiActivity.destinationCity ?? undefined,
departureCity: apiActivity.departureCity ?? undefined,

tripDurationDays: apiActivity.tripDurationDays ?? undefined,
tripDurationNights: apiActivity.tripDurationNights ?? undefined,

flightIncluded: apiActivity.flightIncluded ?? undefined,
airline: apiActivity.airline ?? undefined,
flightNotes: apiActivity.flightNotes ?? undefined,

hotelIncluded: apiActivity.hotelIncluded ?? undefined,
hotelName: apiActivity.hotelName ?? undefined,
hotelRating: apiActivity.hotelRating ?? undefined,
roomType: apiActivity.roomType ?? undefined,
mealPlan: apiActivity.mealPlan ?? undefined,

visaSupportIncluded: apiActivity.visaSupportIncluded ?? undefined,
travelInsuranceIncluded: apiActivity.travelInsuranceIncluded ?? undefined,
airportTransferIncluded: apiActivity.airportTransferIncluded ?? undefined,

packageItinerary: apiActivity.packageItinerary ?? undefined,
requiredDocuments: apiActivity.requiredDocuments ?? undefined,
cancellationPolicy: apiActivity.cancellationPolicy ?? undefined,
availableTravelDates: apiActivity.availableTravelDates ?? undefined,
minimumGroupSize: apiActivity.minimumGroupSize ?? undefined,
packageInclusions: apiActivity.packageInclusions ?? undefined,
packageExclusions: apiActivity.packageExclusions ?? undefined,

specs: {
  durationType: asActivityDurationType(apiActivity.durationType),
  experienceType: asActivityType(apiActivity.activityType),
  familyFriendly: apiActivity.familyFriendly,
  includesTransfer: apiActivity.includesTransfer,
  mealIncluded: apiActivity.mealIncluded,
  outdoor: apiActivity.outdoor
},
featured: apiActivity.travelAgency?.featured === true,
provider,
travelAgencyId: apiActivity.travelAgencyId ?? undefined,
travelAgency,
groupSize: apiActivity.groupSize ?? undefined,
difficulty: asActivityDifficulty(apiActivity.difficulty),
language: apiActivity.language ?? undefined,
nearestLandmarkId: apiActivity.nearestLandmarkId ?? undefined,
nearestLandmarkName: nearestLandmark?.name

};
}
