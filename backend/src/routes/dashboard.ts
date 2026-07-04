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


type DashboardAttentionPriority = 'critical' | 'high' | 'medium' | 'low';

type DashboardAttentionItem = {
  key: string;
  priority: DashboardAttentionPriority;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  actionTo?: string;
};

type DashboardHealthInput = {
  user: {
    role: string;
    emailVerified: boolean;
    phone?: string | null;
    companyName?: string | null;
  };
  totalListings: number;
  totalActivities: number;
  pendingReviewCount: number;
  pendingPayments: number;
  receivedPendingBookings: number;
  unreadNotifications: number;
  verificationGaps: number;
  mediaGaps: number;
  submittedInquiries: number;
  submittedBookings: number;
  receivedInquiries: number;
  receivedBookingsCount: number;
};

function getPersonaHealthWeights(role: string) {
  if (role === 'ADMIN') {
    return {
      inventory: 0,
      trust: 20,
      media: 20,
      demand: 20,
      payments: 20,
      attention: 20
    };
  }

  if (role === 'USER') {
    return {
      inventory: 0,
      trust: 25,
      media: 0,
      demand: 25,
      payments: 25,
      attention: 25
    };
  }

  return {
    inventory: 20,
    trust: 25,
    media: 15,
    demand: 15,
    payments: 10,
    attention: 15
  };
}

function createDashboardHealth(input: DashboardHealthInput) {
  const weights = getPersonaHealthWeights(input.user.role);
  const hasInventory = input.totalListings + input.totalActivities > 0;
  const hasDemand =
    input.submittedInquiries +
      input.submittedBookings +
      input.receivedInquiries +
      input.receivedBookingsCount >
    0;

  const attentionItems: DashboardAttentionItem[] = [];
  const addAttention = (item: DashboardAttentionItem) => attentionItems.push(item);

  if (!input.user.emailVerified) {
    addAttention({
      key: 'email-verification',
      priority: 'critical',
      labelEn: 'Verify your email',
      labelAr: 'فعّل بريدك الإلكتروني',
      descriptionEn: 'Email verification protects account actions, payments, and publishing workflows.',
      descriptionAr: 'تفعيل البريد يحمي إجراءات الحساب والمدفوعات ومسارات النشر.',
      actionTo: '/profile'
    });
  }

  if (input.user.role !== 'USER' && !hasInventory) {
    addAttention({
      key: 'first-inventory',
      priority: 'high',
      labelEn: input.user.role === 'DEVELOPER' ? 'Prepare project inventory' : 'Add your first marketplace record',
      labelAr: input.user.role === 'DEVELOPER' ? 'جهّز مخزون المشاريع' : 'أضف أول عنصر في السوق',
      descriptionEn: 'A complete inventory is the foundation for leads, bookings, trust, and performance.',
      descriptionAr: 'المخزون المكتمل هو أساس العملاء والحجوزات والثقة والأداء.',
      actionTo: input.user.role === 'OWNER' || input.user.role === 'DEVELOPER' ? '/add-listing' : '/add-activity'
    });
  }

  if (input.pendingReviewCount > 0) {
    addAttention({
      key: 'pending-review',
      priority: 'medium',
      labelEn: `${input.pendingReviewCount} item${input.pendingReviewCount === 1 ? '' : 's'} pending marketplace review`,
      labelAr: `${input.pendingReviewCount} عنصر بانتظار مراجعة السوق`,
      descriptionEn: 'Follow publishing requirements so pending records can move toward approval faster.',
      descriptionAr: 'تابع متطلبات النشر حتى تنتقل العناصر المعلقة نحو الاعتماد بشكل أسرع.'
    });
  }

  if (input.receivedPendingBookings > 0) {
    addAttention({
      key: 'received-bookings',
      priority: 'critical',
      labelEn: `${input.receivedPendingBookings} request${input.receivedPendingBookings === 1 ? '' : 's'} need a decision`,
      labelAr: `${input.receivedPendingBookings} طلب يحتاج قراراً`,
      descriptionEn: 'Fast decisions improve customer confidence and conversion.',
      descriptionAr: 'القرارات السريعة تحسن ثقة العملاء والتحويل.'
    });
  }

  if (input.pendingPayments > 0) {
    addAttention({
      key: 'pending-payments',
      priority: 'high',
      labelEn: `${input.pendingPayments} payment${input.pendingPayments === 1 ? '' : 's'} pending`,
      labelAr: `${input.pendingPayments} دفعة معلقة`,
      descriptionEn: 'Complete or sync payment status to keep active bookings moving.',
      descriptionAr: 'أكمل الدفع أو حدّث حالته للحفاظ على سير الحجوزات النشطة.'
    });
  }

  if (input.verificationGaps > 0) {
    addAttention({
      key: 'verification-gaps',
      priority: 'high',
      labelEn: `${input.verificationGaps} verification gap${input.verificationGaps === 1 ? '' : 's'}`,
      labelAr: `${input.verificationGaps} فجوة تحقق`,
      descriptionEn: 'Verified records build trust and reduce friction in high-value workflows.',
      descriptionAr: 'العناصر الموثقة تبني الثقة وتقلل الاحتكاك في المسارات عالية القيمة.'
    });
  }

  if (input.mediaGaps > 0) {
    addAttention({
      key: 'media-gaps',
      priority: 'medium',
      labelEn: `${input.mediaGaps} media quality item${input.mediaGaps === 1 ? '' : 's'}`,
      labelAr: `${input.mediaGaps} عنصر يحتاج تحسين الوسائط`,
      descriptionEn: 'Premium media helps marketplace records feel more trustworthy and complete.',
      descriptionAr: 'الوسائط الممتازة تجعل عناصر السوق أكثر موثوقية واكتمالاً.'
    });
  }

  if (input.unreadNotifications > 0) {
    addAttention({
      key: 'unread-notifications',
      priority: 'low',
      labelEn: `${input.unreadNotifications} unread notification${input.unreadNotifications === 1 ? '' : 's'}`,
      labelAr: `${input.unreadNotifications} تنبيه غير مقروء`,
      descriptionEn: 'Review recent account, booking, and marketplace updates.',
      descriptionAr: 'راجع آخر تحديثات الحساب والحجوزات والسوق.'
    });
  }

  let readinessScore = 0;

  readinessScore += input.user.emailVerified ? weights.trust : 0;
  readinessScore += hasInventory || weights.inventory === 0 ? weights.inventory : 0;
  readinessScore += input.mediaGaps === 0 ? weights.media : 0;
  readinessScore += hasDemand || input.user.role !== 'USER' ? weights.demand : 0;
  readinessScore += input.pendingPayments === 0 ? weights.payments : 0;
  readinessScore += input.receivedPendingBookings === 0 && input.unreadNotifications === 0
    ? weights.attention
    : Math.floor(weights.attention / 2);

  if (input.user.role === 'ADMIN') {
    readinessScore = Math.max(55, 100 - Math.min(attentionItems.length * 10, 45));
  }

  readinessScore = Math.max(0, Math.min(100, readinessScore));

  return {
    readinessScore,
    attentionCount: attentionItems.length,
    urgentCount: attentionItems.filter((item) => item.priority === 'critical' || item.priority === 'high').length,
    nextBestAction: attentionItems[0] ?? null,
    attentionItems,
    breakdown: {
      emailVerified: input.user.emailVerified,
      hasInventory,
      hasDemand,
      pendingReviewCount: input.pendingReviewCount,
      pendingPayments: input.pendingPayments,
      receivedPendingBookings: input.receivedPendingBookings,
      unreadNotifications: input.unreadNotifications,
      verificationGaps: input.verificationGaps,
      mediaGaps: input.mediaGaps
    }
  };
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
      pendingPayments,
      unreadNotificationsCount,
      verificationGapListings,
      verificationGapActivities,
      mediaGapListings,
      mediaGapActivities,
      savedListingsCount,
      savedActivitiesCount,
      savedSearchesCount,
      totalTravelPackages,
      totalLocalActivities
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
      }),

      prisma.notification.count({
        where: {
          userId,
          readAt: null
        }
      }),

      prisma.listing.count({
        where: {
          ownerId: userId,
          NOT: {
            verificationStatus: 'ADMIN_VERIFIED'
          }
        }
      }),

      prisma.activity.count({
        where: {
          ownerId: userId,
          NOT: {
            verificationStatus: 'ADMIN_VERIFIED'
          }
        }
      }),

      prisma.listing.count({
        where: {
          ownerId: userId,
          mediaQualityStatus: {
            in: ['NOT_CHECKED', 'NEEDS_REVIEW', 'BLOCKED']
          }
        }
      }),

      prisma.activity.count({
        where: {
          ownerId: userId,
          mediaQualityStatus: {
            in: ['NOT_CHECKED', 'NEEDS_REVIEW', 'BLOCKED']
          }
        }
      }),

      prisma.savedListing.count({
        where: {
          userId
        }
      }),

      prisma.savedActivity.count({
        where: {
          userId
        }
      }),

      prisma.savedSearch.count({
        where: {
          userId
        }
      }),

      prisma.activity.count({
        where: {
          ownerId: userId,
          travelRegion: 'OUTSIDE_OMAN'
        }
      }),

      prisma.activity.count({
        where: {
          ownerId: userId,
          travelRegion: 'INSIDE_OMAN'
        }
      })
    ]);

    const pendingReviewCount = pendingListings + pendingActivities;
    const receivedInquiries = receivedListingInquiries + receivedActivityInquiries;
    const verificationGaps = verificationGapListings + verificationGapActivities;
    const mediaGaps = mediaGapListings + mediaGapActivities;
    const savedItemsCount = savedListingsCount + savedActivitiesCount + savedSearchesCount;

    const health = createDashboardHealth({
      user: req.user!,
      totalListings,
      totalActivities,
      pendingReviewCount,
      pendingPayments,
      receivedPendingBookings,
      unreadNotifications: unreadNotificationsCount,
      verificationGaps,
      mediaGaps,
      submittedInquiries,
      submittedBookings,
      receivedInquiries,
      receivedBookingsCount
    });

    res.json({
      health,
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
        receivedInquiries,
        submittedBookings,
        receivedBookings: receivedBookingsCount,
        receivedPendingBookings,
        pendingPayments,
        pendingReviewCount,
        verificationGaps,
        mediaGaps,
        unreadNotifications: unreadNotificationsCount,
        savedListings: savedListingsCount,
        savedActivities: savedActivitiesCount,
        savedSearches: savedSearchesCount,
        savedItems: savedItemsCount,
        totalTravelPackages,
        totalLocalActivities
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
