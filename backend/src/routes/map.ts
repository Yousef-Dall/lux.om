import { Router } from 'express';

import { prisma } from '../lib/prisma';

export const mapRouter = Router();

function decimalToNumber(value: { toString(): string } | number | string | null | undefined) {
  if (value === null || value === undefined) return null;

  const parsed = Number(value.toString());

  return Number.isFinite(parsed) ? parsed : null;
}

mapRouter.get('/markers', async (_req, res, next) => {
  try {
    const [listings, projects] = await Promise.all([
      prisma.listing.findMany({
        where: {
          status: 'APPROVED',
          latitude: {
            not: null
          },
          longitude: {
            not: null
          }
        },
        select: {
          id: true,
          slug: true,
          title: true,
          titleEn: true,
          titleAr: true,
          location: true,
          locationEn: true,
          locationAr: true,
          mapPlaceLabel: true,
          mapAddress: true,
          mapGoogleUrl: true,
          latitude: true,
          longitude: true,
          price: true,
          priceAmount: true,
          priceCurrency: true,
          image: true,
          transaction: true,
          type: true,
          typeEn: true,
          typeAr: true,
          verificationStatus: true,
          developer: {
            select: {
              nameEn: true,
              nameAr: true,
              verified: true
            }
          },
          createdAt: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 200
      }),
      prisma.developerProject.findMany({
        where: {
          status: 'APPROVED',
          latitude: {
            not: null
          },
          longitude: {
            not: null
          }
        },
        select: {
          id: true,
          slug: true,
          nameEn: true,
          nameAr: true,
          locationEn: true,
          locationAr: true,
          mapPlaceLabel: true,
          mapAddress: true,
          mapGoogleUrl: true,
          latitude: true,
          longitude: true,
          startingPriceAmount: true,
          priceCurrency: true,
          priceQualifier: true,
          image: true,
          completionStatus: true,
          developer: {
            select: {
              nameEn: true,
              nameAr: true,
              verified: true
            }
          },
          _count: {
            select: {
              listings: true
            }
          },
          createdAt: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 200
      })
    ]);

    const listingMarkers = listings
      .map((listing) => ({
        id: listing.id,
        kind: 'LISTING' as const,
        slug: listing.slug,
        titleEn: listing.titleEn ?? listing.title,
        titleAr: listing.titleAr,
        locationEn: listing.locationEn ?? listing.location,
        locationAr: listing.locationAr,
        mapPlaceLabel: listing.mapPlaceLabel,
        mapAddress: listing.mapAddress,
        mapGoogleUrl: listing.mapGoogleUrl,
        latitude: decimalToNumber(listing.latitude),
        longitude: decimalToNumber(listing.longitude),
        price: listing.price,
        priceAmount: listing.priceAmount?.toString() ?? null,
        priceCurrency: listing.priceCurrency,
        image: listing.image,
        transaction: listing.transaction,
        categoryEn: listing.typeEn ?? listing.type,
        categoryAr: listing.typeAr,
        partnerNameEn: listing.developer?.nameEn ?? null,
        partnerNameAr: listing.developer?.nameAr ?? null,
        verified: listing.verificationStatus === 'ADMIN_VERIFIED' || listing.verificationStatus === 'EXTERNALLY_VERIFIED' || listing.developer?.verified === true,
        detailPath: `/listings/${listing.slug}`,
        createdAt: listing.createdAt
      }))
      .filter((marker) => marker.latitude !== null && marker.longitude !== null);

    const projectMarkers = projects
      .map((project) => ({
        id: project.id,
        kind: 'PROJECT' as const,
        slug: project.slug,
        titleEn: project.nameEn,
        titleAr: project.nameAr,
        locationEn: project.locationEn,
        locationAr: project.locationAr,
        mapPlaceLabel: project.mapPlaceLabel,
        mapAddress: project.mapAddress,
        mapGoogleUrl: project.mapGoogleUrl,
        latitude: decimalToNumber(project.latitude),
        longitude: decimalToNumber(project.longitude),
        price: project.startingPriceAmount
          ? `${project.priceCurrency ?? 'OMR'} ${project.startingPriceAmount.toString()}`
          : null,
        priceAmount: project.startingPriceAmount?.toString() ?? null,
        priceCurrency: project.priceCurrency,
        image: project.image,
        transaction: 'Project',
        categoryEn: project.completionStatus,
        categoryAr: project.completionStatus,
        partnerNameEn: project.developer?.nameEn ?? null,
        partnerNameAr: project.developer?.nameAr ?? null,
        verified: project.developer?.verified === true,
        unitCount: project._count.listings,
        detailPath: `/projects/${project.slug}`,
        createdAt: project.createdAt
      }))
      .filter((marker) => marker.latitude !== null && marker.longitude !== null);

    res.json({
      markers: [...listingMarkers, ...projectMarkers].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      )
    });
  } catch (error) {
    next(error);
  }
});
