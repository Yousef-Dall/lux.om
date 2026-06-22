import { apiClient } from './client';
import type {
ApiActivity,
ActivityTravelRegion,
DayName,
PriceQualifier,
PriceUnit
} from '../types';

export type CreateActivityPayload = {
titleEn: string;
titleAr?: string;
descriptionEn: string;
descriptionAr?: string;
locationEn: string;
locationAr?: string;
categoryEn: string;
categoryAr?: string;

travelAgencyId?: string;
providerEn?: string;
providerAr?: string;

/**

* Legacy display price remains supported while forms migrate.
  */
  price?: string;

priceAmount?: string | number;
priceCurrency?: string;
priceQualifier?: PriceQualifier;
priceUnit?: PriceUnit;

durationMinutes?: number;
durationLabelEn?: string;
durationLabelAr?: string;
durationType?: string;
groupSize?: string;
language?: string;
difficulty?: string;
activityType?: string;
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

availabilityDays: DayName[];
availabilityStartTime: string;
availabilityEndTime: string;

familyFriendly: boolean;
includesTransfer: boolean;
mealIncluded: boolean;
outdoor: boolean;

nearestLandmarkId?: string;
distanceFromLandmarkEn?: string;
distanceFromLandmarkAr?: string;

images: Array<{
url: string;
altEn?: string;
altAr?: string;
sortOrder?: number;
}>;

highlights: Array<{
textEn: string;
textAr?: string;
}>;
};

export async function createActivity(payload: CreateActivityPayload, token: string) {
return apiClient.post<{ activity: ApiActivity }>('/api/activities', payload, { token });
}
