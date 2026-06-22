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

const bookingInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true
    }
  },
  listing: true,
  activity: true,
  payment: true,
  events: {
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      }
    },
    orderBy: {
      createdAt: 'asc' as const
    }
  }
};


function getBookingOperationDateKey(booking: { scheduledDate?: Date | null }) {
  return booking.scheduledDate
    ? booking.scheduledDate.toISOString().slice(0, 10)
    : 'unscheduled';
}

function getBookingOperationSortValue(booking: { scheduledDate?: Date | null }) {
  return booking.scheduledDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function createReceivedBookingOperations(bookings: any[]) {
  const operationDays = new Map<string, any>();

  for (const booking of bookings) {
    const dateKey = getBookingOperationDateKey(booking);
    const existingDay = operationDays.get(dateKey) ?? {
      date: dateKey,
      sortValue: getBookingOperationSortValue(booking),
      totalBookings: 0,
      totalGuests: 0,
      pendingBookings: 0,
      approvedBookings: 0,
      cancellationRequests: 0,
      paidBookings: 0,
      capacityGuests: 0,
      bookingIds: [],
      bookings: [],
      capacitySlots: new Map<string, number>()
    };

    existingDay.totalBookings += 1;
    existingDay.totalGuests += booking.guests ?? 0;
    existingDay.bookingIds.push(booking.id);
    existingDay.bookings.push(booking);

    if (booking.status === 'PENDING') {
      existingDay.pendingBookings += 1;
    }

    if (booking.status === 'OWNER_APPROVED' || booking.status === 'ADMIN_CONFIRMED') {
      existingDay.approvedBookings += 1;
    }

    if (booking.status === 'CANCELLATION_REQUESTED') {
      existingDay.cancellationRequests += 1;
    }

    if (booking.payment?.status === 'PAID') {
      existingDay.paidBookings += 1;
    }

    if (booking.activity?.capacity) {
      const slotKey = `${booking.activityId ?? booking.activity.id}:${dateKey}:${booking.preferredTime ?? 'any'}`;

      if (!existingDay.capacitySlots.has(slotKey)) {
        existingDay.capacitySlots.set(slotKey, booking.activity.capacity);
      }
    }

    operationDays.set(dateKey, existingDay);
  }

  return Array.from(operationDays.values())
    .map((day) => {
      const capacityGuests = Array.from(
        day.capacitySlots.values() as Iterable<number>
      ).reduce((total, capacity) => total + capacity, 0);

      return {
        date: day.date,
        totalBookings: day.totalBookings,
        totalGuests: day.totalGuests,
        pendingBookings: day.pendingBookings,
        approvedBookings: day.approvedBookings,
        cancellationRequests: day.cancellationRequests,
        paidBookings: day.paidBookings,
        capacityGuests: capacityGuests || null,
        availableGuests: capacityGuests ? Math.max(capacityGuests - day.totalGuests, 0) : null,
        bookingIds: day.bookingIds,
        bookings: day.bookings
      };
    })
    .sort((first, second) => {
      const firstSortValue =
        first.date === 'unscheduled' ? Number.MAX_SAFE_INTEGER : Date.parse(first.date);
      const secondSortValue =
        second.date === 'unscheduled' ? Number.MAX_SAFE_INTEGER : Date.parse(second.date);

      return firstSortValue - secondSortValue;
    });
}

function getReceivedBookingsWhere(userId: string) {
  return {
    OR: [
      {
        listing: {
          ownerId: userId
        }
      },
      {
        activity: {
          ownerId: userId
        }
      }
    ]
  };
}

dashboardRouter.get('/', requireAuth(), async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const receivedBookingsWhere = getReceivedBookingsWhere(userId);

    const [
      listings,
      activities,
      bookings,
      receivedBookings,
      receivedOperationsBookings,
      notifications,
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
      receivedActivityInquiries,
      submittedBookings,
      receivedBookingsCount,
      receivedPendingBookings,
      pendingPayments
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

      prisma.booking.findMany({
        where: {
          userId
        },
        include: bookingInclude,
        orderBy: {
          createdAt: 'desc'
        },
        take: 8
      }),

      prisma.booking.findMany({
        where: receivedBookingsWhere,
        include: bookingInclude,
        orderBy: {
          createdAt: 'desc'
        },
        take: 8
      }),

      prisma.booking.findMany({
        where: receivedBookingsWhere,
        include: bookingInclude,
        orderBy: [
          {
            scheduledDate: 'asc'
          },
          {
            createdAt: 'desc'
          }
        ],
        take: 80
      }),

      prisma.notification.findMany({
        where: {
          userId
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 8
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
      }),

      prisma.booking.count({
        where: {
          userId
        }
      }),

      prisma.booking.count({
        where: receivedBookingsWhere
      }),

      prisma.booking.count({
        where: {
          ...receivedBookingsWhere,
          status: 'PENDING'
        }
      }),

      prisma.booking.count({
        where: {
          userId,
          payment: {
            status: 'PENDING'
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
        receivedInquiries: receivedListingInquiries + receivedActivityInquiries,
        submittedBookings,
        receivedBookings: receivedBookingsCount,
        receivedPendingBookings,
        pendingPayments
      },
      listings,
      activities,
      bookings,
      receivedBookings,
      receivedBookingOperations: createReceivedBookingOperations(receivedOperationsBookings),
      notifications
    });
  } catch (error) {
    next(error);
  }
});
