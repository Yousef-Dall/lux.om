import type { ListingTransaction } from '../types';

export type DiscoveryCategoryValue = 'all' | ListingTransaction | 'activities';

export type DiscoveryCategory = {
  value: DiscoveryCategoryValue;
  label: string;
};

export const marketplaceDiscoveryCategories: readonly DiscoveryCategory[] = [
  {
    value: 'all',
    label: 'Everything'
  },
  {
    value: 'Sale',
    label: 'Properties for sale'
  },
  {
    value: 'Rent',
    label: 'Rentals'
  },
  {
    value: 'Short stay',
    label: 'Short stays'
  },
  {
    value: 'activities',
    label: 'Activities'
  }
] as const;

export const homepageQuickSearches = [
  {
    label: 'Beach villas',
    to: '/listings?near=al-mouj-muscat&type=Sale'
  },
  {
    label: 'Weekend chalets',
    to: '/listings?near=jebel-sifah&type=Short%20stay'
  },
  {
    label: 'Activities near Mutrah',
    to: '/activities?near=mutrah-corniche'
  },
  {
    label: 'New developments',
    to: '/developers'
  }
] as const;

export const heroImages = [
  {
    src: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80',
    alt: 'Premium villa living room in Oman-inspired marketplace hero'
  },
  {
    src: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=900&q=80',
    alt: 'Luxury villa with pool and outdoor living area'
  },
  {
    src: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
    alt: 'Blue coastal activity scene for curated Oman activities'
  }
] as const;

export function buildDiscoveryPath(landmarkSlug: string, category: DiscoveryCategoryValue) {
  const encodedLandmark = encodeURIComponent(landmarkSlug);

  if (category === 'activities') {
    return `/activities?near=${encodedLandmark}`;
  }

  if (category === 'all') {
    return `/listings?near=${encodedLandmark}`;
  }

  return `/listings?near=${encodedLandmark}&type=${encodeURIComponent(category)}`;
}