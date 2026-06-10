import { Router } from 'express';

import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

export const dashboardRouter = Router();

const listingInclude = {
  amenities: true,
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true
    }
  },
  developer: true,
  nearestLandmark: true,
  images: {
    orderBy: {
      sortOrder: 'asc' as const
    }
  }
};

const activityInclude = {
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true
    }
  },
  travelAgency: true,
  nearestLandmark: true,
  images: {
    orderBy: {
      sortOrder: 'asc' as const
    }
  },
  highlights: true
};

dashboardRouter.get('/', requireAuth(), async (req, res, next) => {
  try {
    const userId = req.user!.id;

    const [
      listings,
      activities,
      totalListings,
      pendingListings,
      approvedListings,
      rejectedListings,
      totalActivities,
      pendingActivities,
      approvedActivities,
      rejectedActivities,
      submittedInquiries,
      receivedListingInquiries,
      receivedActivityInquiries
    ] = await Promise.all([
      prisma.listing.findMany({
        where: {
          ownerId: userId
        },
        include: listingInclude,
        orderBy: {
          createdAt: 'desc'
        },
        take: 6
      }),

      prisma.activity.findMany({
        where: {
          ownerId: userId
        },
        include: activityInclude,
        orderBy: {
          createdAt: 'desc'
        },
        take: 6
      }),

      prisma.listing.count({
        where: {
          ownerId: userId
        }
      }),

      prisma.listing.count({
        where: {
          ownerId: userId,
          status: 'PENDING'
        }
      }),

      prisma.listing.count({
        where: {
          ownerId: userId,
          status: 'APPROVED'
        }
      }),

      prisma.listing.count({
        where: {
          ownerId: userId,
          status: 'REJECTED'
        }
      }),

      prisma.activity.count({
        where: {
          ownerId: userId
        }
      }),

      prisma.activity.count({
        where: {
          ownerId: userId,
          status: 'PENDING'
        }
      }),

      prisma.activity.count({
        where: {
          ownerId: userId,
          status: 'APPROVED'
        }
      }),

      prisma.activity.count({
        where: {
          ownerId: userId,
          status: 'REJECTED'
        }
      }),

      prisma.inquiry.count({
        where: {
          userId
        }
      }),

      prisma.inquiry.count({
        where: {
          listing: {
            ownerId: userId
          }
        }
      }),

      prisma.inquiry.count({
        where: {
          activity: {
            ownerId: userId
          }
        }
      })
    ]);

    res.json({
      stats: {
        totalListings,
        pendingListings,
        approvedListings,
        rejectedListings,
        totalActivities,
        pendingActivities,
        approvedActivities,
        rejectedActivities,
        submittedInquiries,
        receivedInquiries: receivedListingInquiries + receivedActivityInquiries
      },
      listings,
      activities
    });
  } catch (error) {
    next(error);
  }
});