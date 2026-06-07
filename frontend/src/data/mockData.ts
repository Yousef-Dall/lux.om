import type { Activity, DevelopmentCompany, Landmark, Listing, MarketplaceStats } from '../types';

export const landmarks: Landmark[] = [
  {
    id: 'mall-of-oman',
    slug: 'mall-of-oman',
    name: 'Mall of Oman',
    city: 'Muscat',
    category: 'Mall'
  },
  {
    id: 'muscat-hills',
    slug: 'muscat-hills',
    name: 'Muscat Hills',
    city: 'Muscat',
    category: 'Development area'
  },
  {
    id: 'muscat-grand-mall',
    slug: 'muscat-grand-mall',
    name: 'Muscat Grand Mall',
    city: 'Muscat',
    category: 'Mall'
  },
  {
    id: 'oman-avenues-mall',
    slug: 'oman-avenues-mall',
    name: 'Oman Avenues Mall',
    city: 'Muscat',
    category: 'Mall'
  },
  {
    id: 'sultan-qaboos-grand-mosque',
    slug: 'sultan-qaboos-grand-mosque',
    name: 'Sultan Qaboos Grand Mosque',
    city: 'Muscat',
    category: 'Landmark'
  },
  {
    id: 'al-mouj-muscat',
    slug: 'al-mouj-muscat',
    name: 'Al Mouj Muscat / The Wave',
    city: 'Muscat',
    category: 'Development area'
  },
  {
    id: 'muscat-international-airport',
    slug: 'muscat-international-airport',
    name: 'Muscat International Airport',
    city: 'Muscat',
    category: 'Airport'
  },
  {
    id: 'royal-opera-house-muscat',
    slug: 'royal-opera-house-muscat',
    name: 'Royal Opera House Muscat',
    city: 'Muscat',
    category: 'Landmark'
  },
  {
    id: 'qurum-beach',
    slug: 'qurum-beach',
    name: 'Qurum Beach',
    city: 'Muscat',
    category: 'Beach'
  },
  {
    id: 'mutrah-corniche',
    slug: 'mutrah-corniche',
    name: 'Mutrah Corniche',
    city: 'Muscat',
    category: 'Waterfront'
  },
  {
    id: 'muscat-bay',
    slug: 'muscat-bay',
    name: 'Muscat Bay',
    city: 'Muscat',
    category: 'Development area'
  },
  {
    id: 'jebel-sifah',
    slug: 'jebel-sifah',
    name: 'Jebel Sifah',
    city: 'Muscat',
    category: 'Development area'
  },
  {
    id: 'nizwa-fort',
    slug: 'nizwa-fort',
    name: 'Nizwa Fort',
    city: 'Nizwa',
    category: 'Heritage'
  },
  {
    id: 'salalah-gardens-mall',
    slug: 'salalah-gardens-mall',
    name: 'Salalah Gardens Mall',
    city: 'Salalah',
    category: 'Mall'
  },
  {
    id: 'al-haffa-waterfront',
    slug: 'al-haffa-waterfront',
    name: 'Al Haffa Waterfront',
    city: 'Salalah',
    category: 'Waterfront'
  },
  {
    id: 'sultan-qaboos-university',
    slug: 'sultan-qaboos-university',
    name: 'Sultan Qaboos University',
    city: 'Muscat',
    category: 'University'
  }
];

export const developmentCompanies: DevelopmentCompany[] = [
  {
    id: 'omran-group',
    slug: 'omran-group',
    name: 'OMRAN Group',
    logo: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=700&q=80',
    description:
      'A leading tourism development company focused on destination-scale projects, hospitality assets, and strategic real estate across Oman.',
    headquarters: 'Muscat, Oman',
    location: 'Muscat',
    phone: '+968 9000 1100',
    email: 'partnerships@lux.om',
    website: 'https://lux.om/developers/omran-group',
    verified: true,
    featured: true,
    listedPropertyIds: ['3', '6'],
    featuredProjectIds: ['3', '6'],
    specialties: ['Tourism destinations', 'Hospitality', 'Mixed-use communities'],
    establishedYear: 2005
  },
  {
    id: 'al-mouj-muscat-developments',
    slug: 'al-mouj-muscat-developments',
    name: 'Al Mouj Muscat Developments',
    logo: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=700&q=80',
    description:
      'A premium waterfront community developer known for marina living, high-end residential neighborhoods, hospitality, retail, and lifestyle amenities.',
    headquarters: 'Al Mouj, Muscat',
    location: 'Muscat',
    phone: '+968 9000 2200',
    email: 'developers@lux.om',
    website: 'https://lux.om/developers/al-mouj-muscat-developments',
    verified: true,
    featured: true,
    listedPropertyIds: ['1'],
    featuredProjectIds: ['1'],
    specialties: ['Waterfront communities', 'Luxury villas', 'Marina lifestyle'],
    establishedYear: 2006
  },
  {
    id: 'muscat-hills-development',
    slug: 'muscat-hills-development',
    name: 'Muscat Hills Development',
    logo: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=700&q=80',
    description:
      'A Muscat-based developer focused on golf-view apartments, premium residential buildings, and connected urban living near the airport and business districts.',
    headquarters: 'Muscat Hills, Muscat',
    location: 'Muscat',
    phone: '+968 9000 3300',
    email: 'developers@lux.om',
    website: 'https://lux.om/developers/muscat-hills-development',
    verified: true,
    featured: true,
    listedPropertyIds: ['5'],
    featuredProjectIds: ['5'],
    specialties: ['Golf residences', 'Apartments', 'Urban communities'],
    establishedYear: 2010
  },
  {
    id: 'qurum-premium-properties',
    slug: 'qurum-premium-properties',
    name: 'Qurum Premium Properties',
    logo: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=700&q=80',
    description:
      'A boutique real estate company curating family villas, refined rentals, and residential assets in central Muscat neighborhoods.',
    headquarters: 'Qurum, Muscat',
    location: 'Muscat',
    phone: '+968 9000 4400',
    email: 'partners@lux.om',
    website: 'https://lux.om/developers/qurum-premium-properties',
    verified: true,
    featured: false,
    listedPropertyIds: ['2', '4'],
    featuredProjectIds: ['2'],
    specialties: ['Family villas', 'Long-term rentals', 'Central Muscat homes'],
    establishedYear: 2016
  }
];

function getDeveloperSummary(developerId: string) {
  const developer = developmentCompanies.find((company) => company.id === developerId);

  if (!developer) return undefined;

  return {
    id: developer.id,
    slug: developer.slug,
    name: developer.name,
    logo: developer.logo,
    verified: developer.verified,
    shortDescription: developer.description
  };
}

export const listings: Listing[] = [
  {
    id: '1',
    slug: 'al-mouj-beachfront-villa',
    title: 'Al Mouj Beachfront Villa',
    description:
      'A private beachfront villa with resort-scale outdoor living, refined interiors, and uninterrupted water views. Designed for families who want privacy, scale, and direct access to Muscat’s most polished coastal community.',
    type: 'Villa',
    transaction: 'Sale',
    location: 'Al Mouj, Muscat',
    price: 'OMR 1,250,000',
    beds: 5,
    baths: 6,
    sqm: 650,
    image:
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1600&q=80',
    status: 'APPROVED',
    amenities: ['Private pool', 'Sea view', 'Maid room', 'Covered parking', 'Security'],
    featured: true,
    developerId: 'al-mouj-muscat-developments',
    developer: getDeveloperSummary('al-mouj-muscat-developments'),
    nearestLandmarkId: 'al-mouj-muscat',
    nearestLandmarkName: 'Al Mouj Muscat / The Wave',
    distanceFromLandmark: '3 min drive',
    maxGuests: 10,
    minStayNights: 1,
    parkingSpaces: 4,
    furnishing: 'Furnished',
    view: 'Sea view',
    paymentFrequency: 'Total sale price'
  },
  {
    id: '2',
    slug: 'qurum-contemporary-villa',
    title: 'Qurum Contemporary Villa',
    description:
      'A calm architectural villa in Qurum with generous reception spaces, warm finishes, and excellent access to schools, beaches, and business districts.',
    type: 'Villa',
    transaction: 'Rent',
    location: 'Qurum, Muscat',
    price: 'OMR 2,800 /mo',
    beds: 4,
    baths: 5,
    sqm: 420,
    image:
      'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1600&q=80',
    status: 'APPROVED',
    amenities: ['Garden', 'Driver room', 'Smart access', 'Family lounge', 'Parking'],
    featured: true,
    developerId: 'qurum-premium-properties',
    developer: getDeveloperSummary('qurum-premium-properties'),
    nearestLandmarkId: 'qurum-beach',
    nearestLandmarkName: 'Qurum Beach',
    distanceFromLandmark: '6 min drive',
    maxGuests: 8,
    minStayNights: 30,
    parkingSpaces: 3,
    furnishing: 'Semi-furnished',
    view: 'Garden view',
    paymentFrequency: 'Per month'
  },
  {
    id: '3',
    slug: 'jebel-sifah-weekend-chalet',
    title: 'Jebel Sifah Weekend Chalet',
    description:
      'A polished chalet for short stays with a terrace, sea breeze, and access to one of Oman’s favorite weekend destinations.',
    type: 'Chalet',
    transaction: 'Short stay',
    location: 'Jebel Sifah, Muscat',
    price: 'OMR 95 /night',
    beds: 2,
    baths: 2,
    sqm: 140,
    image:
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1600&q=80',
    status: 'APPROVED',
    amenities: ['Terrace', 'Kitchen', 'Pool access', 'Beach nearby', 'Family friendly'],
    featured: true,
    developerId: 'omran-group',
    developer: getDeveloperSummary('omran-group'),
    nearestLandmarkId: 'jebel-sifah',
    nearestLandmarkName: 'Jebel Sifah',
    distanceFromLandmark: 'Inside destination',
    maxGuests: 5,
    minStayNights: 2,
    parkingSpaces: 1,
    furnishing: 'Furnished',
    view: 'Sea view',
    paymentFrequency: 'Per night'
  },
  {
    id: '4',
    slug: 'muttrah-heritage-apartment',
    title: 'Muttrah Heritage Apartment',
    description:
      'A characterful apartment near the corniche and souq, suited for guests who want texture, culture, and walkable old Muscat charm.',
    type: 'Apartment',
    transaction: 'Rent',
    location: 'Muttrah, Muscat',
    price: 'OMR 520 /mo',
    beds: 2,
    baths: 2,
    sqm: 105,
    image:
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1600&q=80',
    status: 'APPROVED',
    amenities: ['Balcony', 'Walkable area', 'Furnished', 'Parking'],
    developerId: 'qurum-premium-properties',
    developer: getDeveloperSummary('qurum-premium-properties'),
    nearestLandmarkId: 'mutrah-corniche',
    nearestLandmarkName: 'Mutrah Corniche',
    distanceFromLandmark: '4 min walk',
    maxGuests: 4,
    minStayNights: 30,
    parkingSpaces: 1,
    floorNumber: 3,
    furnishing: 'Furnished',
    view: 'City view',
    paymentFrequency: 'Per month'
  },
  {
    id: '5',
    slug: 'muscat-hills-penthouse',
    title: 'Muscat Hills Penthouse',
    description:
      'A bright penthouse with golf-course views, generous glazing, and a refined open-plan living area.',
    type: 'Penthouse',
    transaction: 'Sale',
    location: 'Muscat Hills, Muscat',
    price: 'OMR 395,000',
    beds: 3,
    baths: 4,
    sqm: 260,
    image:
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1600&q=80',
    status: 'APPROVED',
    amenities: ['Golf view', 'Elevator', 'Gym access', 'Underground parking'],
    featured: true,
    developerId: 'muscat-hills-development',
    developer: getDeveloperSummary('muscat-hills-development'),
    nearestLandmarkId: 'muscat-hills',
    nearestLandmarkName: 'Muscat Hills',
    distanceFromLandmark: 'Inside district',
    maxGuests: 6,
    parkingSpaces: 2,
    floorNumber: 9,
    furnishing: 'Furnished',
    view: 'Golf view',
    paymentFrequency: 'Total sale price'
  },
  {
    id: '6',
    slug: 'salalah-family-resort-stay',
    title: 'Salalah Family Resort Stay',
    description:
      'A seasonal escape for families looking for greenery, comfort, and a simple booking experience during Khareef.',
    type: 'Resort apartment',
    transaction: 'Short stay',
    location: 'Salalah, Dhofar',
    price: 'OMR 120 /night',
    beds: 3,
    baths: 3,
    sqm: 190,
    image:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&q=80',
    status: 'APPROVED',
    amenities: ['Resort access', 'Family friendly', 'Housekeeping', 'Pool'],
    developerId: 'omran-group',
    developer: getDeveloperSummary('omran-group'),
    nearestLandmarkId: 'salalah-gardens-mall',
    nearestLandmarkName: 'Salalah Gardens Mall',
    distanceFromLandmark: '8 min drive',
    maxGuests: 7,
    minStayNights: 2,
    parkingSpaces: 2,
    furnishing: 'Furnished',
    view: 'Garden view',
    paymentFrequency: 'Per night'
  }
];

export const activities: Activity[] = [
  {
    id: '1',
    slug: 'wahiba-sands-private-camp',
    title: 'Wahiba Sands Private Camp',
    description:
      'A private desert stay with sunset dune driving, dinner under the stars, and a hosted overnight camp experience.',
    location: 'Sharqiyah Sands',
    duration: '1 night',
    durationMinutes: 720,
    price: 'From OMR 180',
    image:
      'https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=1600&q=80',
    category: 'Desert',
    highlights: ['Private guide', 'Dinner setup', 'Dune transfer'],
    availability: {
      days: ['Thursday', 'Friday', 'Saturday'],
      startTime: '15:00',
      endTime: '23:30'
    },
    specs: {
      durationType: 'Overnight',
      experienceType: 'Private',
      familyFriendly: true,
      includesTransfer: true,
      mealIncluded: true,
      outdoor: true
    },
    featured: true,
    provider: 'Sharqiyah Desert Hosts',
    groupSize: '2-8 guests',
    difficulty: 'Easy',
    language: 'Arabic / English'
  },
  {
    id: '2',
    slug: 'dimaniyat-islands-yacht-day',
    title: 'Dimaniyat Islands Yacht Day',
    description:
      'A polished day at sea with snorkeling, private boat transfer, drinks, and an easy premium itinerary.',
    location: 'Muscat Coast',
    duration: '6 hours',
    durationMinutes: 360,
    price: 'From OMR 240',
    image:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
    category: 'Sea',
    highlights: ['Private boat', 'Snorkeling', 'Refreshments'],
    availability: {
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      startTime: '08:00',
      endTime: '16:00'
    },
    specs: {
      durationType: 'Half day',
      experienceType: 'Private',
      familyFriendly: true,
      includesTransfer: false,
      mealIncluded: false,
      outdoor: true
    },
    featured: true,
    provider: 'Muscat Coast Activities',
    groupSize: '4-12 guests',
    difficulty: 'Easy',
    language: 'Arabic / English',
    nearestLandmarkId: 'al-mouj-muscat',
    nearestLandmarkName: 'Al Mouj Muscat / The Wave'
  },
  {
    id: '3',
    slug: 'nizwa-heritage-tour',
    title: 'Nizwa Heritage Tour',
    description:
      'A curated cultural route through Nizwa Fort, the souq, and nearby villages with a local host.',
    location: 'Nizwa, Al Dakhiliyah',
    duration: 'Full day',
    durationMinutes: 480,
    price: 'From OMR 75',
    image:
      'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1600&q=80',
    category: 'Culture',
    highlights: ['Local guide', 'Fort visit', 'Souq walk'],
    availability: {
      days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday'],
      startTime: '09:00',
      endTime: '17:00'
    },
    specs: {
      durationType: 'Full day',
      experienceType: 'Group',
      familyFriendly: true,
      includesTransfer: true,
      mealIncluded: false,
      outdoor: true
    },
    featured: true,
    provider: 'Nizwa Heritage Guides',
    groupSize: '6-14 guests',
    difficulty: 'Easy',
    language: 'Arabic / English',
    nearestLandmarkId: 'nizwa-fort',
    nearestLandmarkName: 'Nizwa Fort'
  },
  {
    id: '4',
    slug: 'wadi-shab-guided-hike',
    title: 'Wadi Shab Guided Hike',
    description:
      'A guided outdoor hike through one of Oman’s most loved wadis with swimming stops, route support, and a relaxed adventure pace.',
    location: 'Tiwi, South Al Sharqiyah',
    duration: '4 hours',
    durationMinutes: 240,
    price: 'From OMR 55',
    image:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80',
    category: 'Adventure',
    highlights: ['Guided hike', 'Swimming stops', 'Outdoor route'],
    availability: {
      days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      startTime: '07:00',
      endTime: '12:00'
    },
    specs: {
      durationType: 'Half day',
      experienceType: 'Group',
      familyFriendly: false,
      includesTransfer: false,
      mealIncluded: false,
      outdoor: true
    },
    provider: 'Oman Adventure Routes',
    groupSize: '4-10 guests',
    difficulty: 'Moderate',
    language: 'English'
  },
  {
    id: '5',
    slug: 'muscat-sunset-dhow-cruise',
    title: 'Muscat Sunset Dhow Cruise',
    description:
      'A calm sunset cruise along the Muscat coastline with traditional dhow atmosphere, soft drinks, and scenic sea views.',
    location: 'Marina Bandar Al Rowdha, Muscat',
    duration: '2 hours',
    durationMinutes: 120,
    price: 'From OMR 35',
    image:
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1600&q=80',
    category: 'Sea',
    highlights: ['Sunset cruise', 'Soft drinks', 'Coastline views'],
    availability: {
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      startTime: '16:30',
      endTime: '18:30'
    },
    specs: {
      durationType: 'Short',
      experienceType: 'Group',
      familyFriendly: true,
      includesTransfer: false,
      mealIncluded: false,
      outdoor: true
    },
    provider: 'Muscat Dhow Collective',
    groupSize: '8-20 guests',
    difficulty: 'Easy',
    language: 'Arabic / English',
    nearestLandmarkId: 'mutrah-corniche',
    nearestLandmarkName: 'Mutrah Corniche'
  },
  {
    id: '6',
    slug: 'jebel-akhdar-private-picnic',
    title: 'Jebel Akhdar Private Picnic',
    description:
      'A private mountain picnic setup with scenic viewpoints, local snacks, and a slow premium escape from the city.',
    location: 'Jebel Akhdar, Al Dakhiliyah',
    duration: '3 hours',
    durationMinutes: 180,
    price: 'From OMR 90',
    image:
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1600&q=80',
    category: 'Mountain',
    highlights: ['Private setup', 'Mountain views', 'Local snacks'],
    availability: {
      days: ['Thursday', 'Friday', 'Saturday'],
      startTime: '10:00',
      endTime: '14:00'
    },
    specs: {
      durationType: 'Short',
      experienceType: 'Private',
      familyFriendly: true,
      includesTransfer: false,
      mealIncluded: true,
      outdoor: true
    },
    provider: 'Jebel Akhdar Hosts',
    groupSize: '2-6 guests',
    difficulty: 'Easy',
    language: 'Arabic / English'
  },
  {
    id: '7',
    slug: 'muttrah-food-walk',
    title: 'Muttrah Food Walk',
    description:
      'A guided evening food walk through Muttrah with local bites, souq stories, and cultural context for visitors.',
    location: 'Muttrah, Muscat',
    duration: '3 hours',
    durationMinutes: 180,
    price: 'From OMR 45',
    image:
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1600&q=80',
    category: 'Culture',
    highlights: ['Local food', 'Souq walk', 'Evening guide'],
    availability: {
      days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
      startTime: '18:00',
      endTime: '21:00'
    },
    specs: {
      durationType: 'Short',
      experienceType: 'Group',
      familyFriendly: true,
      includesTransfer: false,
      mealIncluded: true,
      outdoor: true
    },
    provider: 'Muttrah Local Walks',
    groupSize: '4-12 guests',
    difficulty: 'Easy',
    language: 'Arabic / English',
    nearestLandmarkId: 'mutrah-corniche',
    nearestLandmarkName: 'Mutrah Corniche'
  },
  {
    id: '8',
    slug: 'salalah-khareef-nature-day',
    title: 'Salalah Khareef Nature Day',
    description:
      'A full-day nature route around Salalah during Khareef with waterfalls, greenery, viewpoints, and guided stops.',
    location: 'Salalah, Dhofar',
    duration: 'Full day',
    durationMinutes: 480,
    price: 'From OMR 85',
    image:
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1600&q=80',
    category: 'Nature',
    highlights: ['Waterfalls', 'Viewpoints', 'Guided route'],
    availability: {
      days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      startTime: '08:00',
      endTime: '17:00'
    },
    specs: {
      durationType: 'Full day',
      experienceType: 'Both',
      familyFriendly: true,
      includesTransfer: true,
      mealIncluded: false,
      outdoor: true
    },
    provider: 'Dhofar Nature Routes',
    groupSize: '4-14 guests',
    difficulty: 'Moderate',
    language: 'Arabic / English',
    nearestLandmarkId: 'al-haffa-waterfront',
    nearestLandmarkName: 'Al Haffa Waterfront'
  }
];

export const marketplaceStats: MarketplaceStats = {
  listings: listings.length,
  activities: activities.length,
  developers: developmentCompanies.length,
  verifiedPartners: developmentCompanies.filter((company) => company.verified).length
};

export const stats = [
  { value: `${listings.length}+`, label: 'premium homes and stays' },
  { value: `${landmarks.length}`, label: 'landmarks and areas indexed' },
  { value: `${activities.length}+`, label: 'curated activities' },
  { value: `${developmentCompanies.filter((company) => company.verified).length}`, label: 'verified partners' }
];

/**
 * Temporary internal alias.
 * New code should import `activities`.
 */
export const experiences = activities;