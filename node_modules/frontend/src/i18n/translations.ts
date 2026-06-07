export type Language = 'en' | 'ar';

const enActivities = {
  eyebrow: 'Activities',
  title: 'Find an activity that fits your free time',
  description:
    'Choose when you are free and we’ll show activities available around that date and time.',
  normalFilters: 'Normal filters',
  quickSearch: 'Quick search',
  searchPlaceholder: 'Search desert, sea, culture...',
  date: 'Date',
  startTime: 'Start time',
  freeFrom: 'Free from',
  freeUntil: 'Free until',
  duration: 'Duration',
  reset: 'Reset',
  search: 'Search',
  location: 'Location',
  locationPlaceholder: 'Muscat, Nizwa, Sharqiyah...',
  category: 'Category',
  advancedFilters: 'Advanced filters',
  advancedSubtitle: 'Premium-style activity search',
  premiumNote:
    'Use advanced filters to find activities by duration, type, inclusions, and preferred style.',
  maxPriceKeyword: 'Price keyword',
  durationType: 'Duration type',
  activityType: 'Activity type',
  experienceType: 'Activity type',
  familyFriendly: 'Family friendly',
  includesTransfer: 'Includes transfer',
  mealIncluded: 'Meal included',
  outdoor: 'Outdoor',
  all: 'All',
  private: 'Private',
  group: 'Group',
  both: 'Both',
  short: 'Short',
  halfDay: 'Half day',
  fullDay: 'Full day',
  overnight: 'Overnight',
  resultsFound: 'activities found',
  resultFound: 'activity found',
  normalAdvanced: 'Normal + advanced filters',
  availableOn: 'Showing activities available on',
  availableBetween: 'Showing activities that fit your free time on',
  at: 'at',
  for: 'for',
  between: 'between',
  and: 'and',
  hours: 'hours',
  hour: 'hour',
  timeError: 'Please choose an end time after the start time.',
  noResultsTitle: 'No activities found for that time',
  noResultsText: 'Try a different date, start time, or end time.',
  requestBooking: 'Request booking',
  overview: 'Activity overview',
  highlights: 'Highlights',
  availability: 'Availability',
  availableDays: 'Available days',
  availableTime: 'Available time',
  from: 'From',
  to: 'to',
  advancedDetails: 'Advanced details',
  finalConfirmation:
    'Final schedule, availability, and inclusions are confirmed before payment.'
};

const enAddActivity = {
  eyebrow: 'Activity providers',
  title: 'List your activity',
  description:
    'Add a curated activity, tour, trip, or private service so guests can discover it by time, date, category, and preferences.',
  qualityEyebrow: 'Activity quality',
  ready: 'ready',
  qualityText:
    'Complete the key details to make your activity easier to approve and easier for guests to find.',
  basicInfo: 'Basic info',
  activityDetails: 'Activity details',
  experienceDetails: 'Activity details',
  activityTitle: 'Activity title',
  experienceTitle: 'Activity title',
  titlePlaceholder: 'Sunset desert camp, private yacht trip...',
  category: 'Category',
  location: 'Location',
  locationPlaceholder: 'Muscat, Nizwa, Salalah...',
  price: 'Price',
  pricePlaceholder: 'From OMR 45',
  duration: 'Duration',
  durationPlaceholder: '4 hours, Full day, 1 night...',
  durationMinutes: 'Duration in minutes',
  availability: 'Availability',
  whenAvailable: 'When is it available?',
  startTime: 'Start time',
  endTime: 'End time',
  advancedData: 'Advanced data',
  searchableSpecs: 'Searchable activity specs',
  durationType: 'Duration type',
  activityType: 'Activity type',
  experienceType: 'Activity type',
  familyFriendly: 'Family friendly',
  includesTransfer: 'Includes transfer',
  mealIncluded: 'Meal included',
  outdoor: 'Outdoor',
  highlights: 'Highlights',
  whatIncluded: 'What is included?',
  otherHighlights: 'Other highlights',
  otherHighlightsPlaceholder: 'Write extra highlights separated by commas',
  media: 'Media',
  activityImage: 'Activity image',
  experienceImage: 'Activity image',
  uploadImage: 'Upload image',
  useImageUrl: 'Use image URL',
  chooseImage: 'Choose an image',
  imageHint: 'PNG, JPG, or WEBP. Use a clear image that sells the activity.',
  imageUrl: 'Image URL',
  imageUrlPlaceholder: 'https://images.unsplash.com/...',
  finalDetails: 'Final details',
  descriptionLabel: 'Description',
  descriptionPlaceholder:
    'Describe the activity, what guests will do, what is included, and what makes it special.',
  reviewHint: 'Activities are reviewed before going public.',
  submitted: 'Activity submitted for review.',
  uploadRequired: 'Please upload an image before submitting.',
  urlRequired: 'Please add an image URL before submitting.',
  selectAtLeastOneDay: 'Please select at least one available day.'
};

const arActivities = {
  eyebrow: 'الأنشطة',
  title: 'ابحث عن نشاط يناسب وقت فراغك',
  description: 'اختر الوقت الذي تكون فيه متاحاً وسنعرض لك الأنشطة المناسبة لذلك الموعد.',
  normalFilters: 'فلاتر عادية',
  quickSearch: 'بحث سريع',
  searchPlaceholder: 'ابحث عن صحراء، بحر، ثقافة...',
  date: 'التاريخ',
  startTime: 'وقت البداية',
  freeFrom: 'متاح من',
  freeUntil: 'متاح إلى',
  duration: 'المدة',
  reset: 'مسح',
  search: 'بحث',
  location: 'الموقع',
  locationPlaceholder: 'مسقط، نزوى، الشرقية...',
  category: 'التصنيف',
  advancedFilters: 'فلاتر متقدمة',
  advancedSubtitle: 'بحث دقيق للأنشطة',
  premiumNote:
    'استخدم الفلاتر المتقدمة للبحث حسب المدة والنوع والمشتملات ونمط النشاط.',
  maxPriceKeyword: 'كلمة في السعر',
  durationType: 'نوع المدة',
  activityType: 'نوع النشاط',
  experienceType: 'نوع النشاط',
  familyFriendly: 'مناسب للعائلات',
  includesTransfer: 'يشمل المواصلات',
  mealIncluded: 'يشمل وجبة',
  outdoor: 'نشاط خارجي',
  all: 'الكل',
  private: 'خاص',
  group: 'جماعي',
  both: 'الاثنان',
  short: 'قصير',
  halfDay: 'نصف يوم',
  fullDay: 'يوم كامل',
  overnight: 'ليلة كاملة',
  resultsFound: 'أنشطة موجودة',
  resultFound: 'نشاط موجود',
  normalAdvanced: 'فلاتر عادية + متقدمة',
  availableOn: 'عرض الأنشطة المتاحة يوم',
  availableBetween: 'عرض الأنشطة التي تناسب وقت فراغك يوم',
  at: 'الساعة',
  for: 'لمدة',
  between: 'بين',
  and: 'و',
  hours: 'ساعات',
  hour: 'ساعة',
  timeError: 'يرجى اختيار وقت نهاية بعد وقت البداية.',
  noResultsTitle: 'لا توجد أنشطة في هذا الوقت',
  noResultsText: 'جرب تاريخاً آخر، وقت بداية مختلف، أو وقت نهاية مختلف.',
  requestBooking: 'طلب الحجز',
  overview: 'نبذة عن النشاط',
  highlights: 'أبرز المميزات',
  availability: 'المواعيد المتاحة',
  availableDays: 'الأيام المتاحة',
  availableTime: 'الوقت المتاح',
  from: 'من',
  to: 'إلى',
  advancedDetails: 'تفاصيل متقدمة',
  finalConfirmation: 'يتم تأكيد الجدول النهائي والتوفر والمشتملات قبل الدفع.'
};

const arAddActivity = {
  eyebrow: 'مزودو الأنشطة',
  title: 'أضف نشاطاً',
  description:
    'أضف نشاطاً أو رحلة أو جولة أو خدمة خاصة ليتمكن الزوار من العثور عليها حسب الوقت والتاريخ والفئة والتفضيلات.',
  qualityEyebrow: 'جودة النشاط',
  ready: 'جاهز',
  qualityText:
    'أكمل التفاصيل الأساسية حتى يصبح النشاط أسهل للمراجعة وأسهل للعثور عليه.',
  basicInfo: 'المعلومات الأساسية',
  activityDetails: 'تفاصيل النشاط',
  experienceDetails: 'تفاصيل النشاط',
  activityTitle: 'عنوان النشاط',
  experienceTitle: 'عنوان النشاط',
  titlePlaceholder: 'مخيم صحراوي عند الغروب، رحلة يخت خاصة...',
  category: 'الفئة',
  location: 'الموقع',
  locationPlaceholder: 'مسقط، نزوى، صلالة...',
  price: 'السعر',
  pricePlaceholder: 'ابتداءً من 45 ريال',
  duration: 'المدة',
  durationPlaceholder: '4 ساعات، يوم كامل، ليلة واحدة...',
  durationMinutes: 'المدة بالدقائق',
  availability: 'التوفر',
  whenAvailable: 'متى يكون النشاط متاحاً؟',
  startTime: 'وقت البداية',
  endTime: 'وقت النهاية',
  advancedData: 'بيانات متقدمة',
  searchableSpecs: 'مواصفات قابلة للبحث',
  durationType: 'نوع المدة',
  activityType: 'نوع النشاط',
  experienceType: 'نوع النشاط',
  familyFriendly: 'مناسب للعائلات',
  includesTransfer: 'تشمل المواصلات',
  mealIncluded: 'تشمل وجبة',
  outdoor: 'في الخارج',
  highlights: 'المميزات',
  whatIncluded: 'ما الذي يشمله النشاط؟',
  otherHighlights: 'مميزات أخرى',
  otherHighlightsPlaceholder: 'اكتب مميزات إضافية وافصل بينها بفواصل',
  media: 'الصور',
  activityImage: 'صورة النشاط',
  experienceImage: 'صورة النشاط',
  uploadImage: 'رفع صورة',
  useImageUrl: 'استخدام رابط صورة',
  chooseImage: 'اختر صورة',
  imageHint: 'PNG أو JPG أو WEBP. استخدم صورة واضحة وجذابة للنشاط.',
  imageUrl: 'رابط الصورة',
  imageUrlPlaceholder: 'https://images.unsplash.com/...',
  finalDetails: 'التفاصيل النهائية',
  descriptionLabel: 'الوصف',
  descriptionPlaceholder:
    'اكتب وصف النشاط وما الذي سيفعله الضيوف وما الذي يشمله وما الذي يميزه.',
  reviewHint: 'تتم مراجعة الأنشطة قبل نشرها.',
  submitted: 'تم إرسال النشاط للمراجعة.',
  uploadRequired: 'يرجى رفع صورة قبل الإرسال.',
  urlRequired: 'يرجى إضافة رابط الصورة قبل الإرسال.',
  selectAtLeastOneDay: 'يرجى اختيار يوم واحد على الأقل.'
};

export const translations = {
  en: {
    common: {
      language: 'العربية',
      brandSubtitle: 'Oman, curated',
      listProperty: 'List a property',
      listActivity: 'List an activity',
      listExperience: 'List an activity',
      exploreListings: 'Explore listings',
      viewActivities: 'View activities',
      viewExperiences: 'View activities',
      requestDetails: 'Request details',
      contactOwner: 'Contact owner',
      sendInquiry: 'Send inquiry',
      submitForReview: 'Submit for review',
      resetFilters: 'Reset filters',
      show: 'Show',
      hide: 'Hide',
      backToListings: 'Back to listings',
      backToActivities: 'Back to activities',
      backToExperiences: 'Back to activities',
      view: 'View',
      yes: 'Yes',
      no: 'No',
      any: 'Any'
    },

    nav: {
      listings: 'Listings',
      activities: 'Activities',
      experiences: 'Activities',
      developers: 'Developers',
      about: 'About',
      contact: 'Contact'
    },

    footer: {
      tagline: 'Premium stays, homes, activities, and development projects.',
      description:
        'lux.om is a curated Oman marketplace for properties for sale, rentals, short stays, activities, and development companies.',
      explore: 'Explore',
      owners: 'Owners & partners',
      dashboard: 'Dashboard',
      admin: 'Admin',
      contact: 'Contact',
      address: 'Muscat, Sultanate of Oman',
      partnerEyebrow: 'Owners and developers',
      partnerTitle: 'Bring premium properties and projects to lux.om',
      partnerText:
        'List individual properties, showcase development company profiles, and connect serious buyers, renters, and guests with high-quality opportunities across Oman.',
      partnerWithLux: 'Partner with lux.om',
      bottomLine: 'Premium Oman real estate and lifestyle marketplace'
    },

    home: {
      eyebrow: 'Premium Oman marketplace',
      title: 'Homes, stays, activities, and developments curated for Oman.',
      description:
        'Browse premium properties for sale, rentals, short stays, local activities, and trusted development companies across Oman.',
      searchPlaceholder: 'Search Muscat villas, Sifah chalets, Al Mouj projects...',
      verified: 'Verified collection',
      verifiedText: 'Premium homes and projects',
      featuredHomesEyebrow: 'Featured properties',
      featuredHomesTitle: 'Polished properties for sale, rent, and short stay',
      featuredHomesDescription:
        'Handpicked spaces with clear details, premium imagery, trusted company context, and owner-friendly workflows.',
      whyEyebrow: 'Why lux.om',
      whyTitle: 'Built for trust from first browse to final inquiry',
      benefits: [
        'Verified listings, owners, and development company profiles',
        'Clear short-stay, rent, sale, and activity journeys',
        'Landmark-based discovery for serious customers',
        'Admin approval before listings go public'
      ],
      activitiesEyebrow: 'Activities',
      activitiesTitle: 'Curated ways to explore Oman',
      activitiesDescription:
        'Premium activities, trips, and day experiences for guests who want more than a place to stay.',
      experiencesEyebrow: 'Activities',
      experiencesTitle: 'Curated ways to explore Oman',
      experiencesDescription:
        'Premium activities, trips, and day experiences for guests who want more than a place to stay.'
    },

    listings: {
      eyebrow: 'Listings',
      title: 'Find your next premium space in Oman',
      description:
        'Search properties for sale, rentals, and short stays with filters built for serious buyers, renters, and guests.',
      normalFilters: 'Normal filters',
      quickSearch: 'Quick search',
      searchPlaceholder: 'Search villa, chalet, Muscat, developer...',
      transaction: 'Transaction',
      propertyType: 'Property type',
      location: 'Location',
      locationPlaceholder: 'Muscat, Salalah, Sifah...',
      advancedFilters: 'Advanced filters',
      advancedSubtitle: 'Premium-style precision search',
      premiumNote:
        'Use advanced filters to narrow properties by specifications, amenities, lifestyle fit, and developer-linked context.',
      minBedrooms: 'Minimum bedrooms',
      minBathrooms: 'Minimum bathrooms',
      minArea: 'Minimum area',
      priceKeyword: 'Price keyword',
      amenities: 'Amenities',
      results: 'listings found',
      result: 'listing found',
      noResultsTitle: 'No listings found',
      noResultsText: 'Try removing one or more filters, or search a wider location.',
      normalAdvanced: 'Normal + advanced filters',
      aboutProperty: 'About this property',
      summary: 'Listing summary',
      contactHint:
        'Exact contact and inquiry details can be shared after login or direct request, depending on owner settings.'
    },

    activities: enActivities,
    experiences: enActivities,

    addListing: {
      eyebrow: 'Owners',
      title: 'Submit a property for review',
      description:
        'Add the details buyers and renters actually search for, including premium filter specifications and development company context.',
      basicInfo: 'Basic information',
      propertyDetails: 'Property details',
      propertyTitle: 'Property title',
      type: 'Type',
      transaction: 'Transaction',
      location: 'Location',
      locationPlaceholder: 'Muscat, Al Mouj, Salalah...',
      price: 'Price',
      pricePlaceholder: 'OMR 900 /mo',
      paymentFrequency: 'Payment frequency',
      bedrooms: 'Bedrooms',
      bathrooms: 'Bathrooms',
      area: 'Area sqm',
      advancedData: 'Advanced filter data',
      searchableSpecs: 'Specifications people search for',
      maxGuests: 'Maximum guests',
      maxGuestsPlaceholder: 'For short stays',
      minStay: 'Minimum stay nights',
      minStayPlaceholder: 'For chalets or short stays',
      parkingSpaces: 'Parking spaces',
      floorNumber: 'Floor number',
      floorNumberPlaceholder: 'For apartments',
      furnishing: 'Furnishing',
      view: 'View',
      amenities: 'Amenities',
      otherAmenities: 'Other amenities',
      otherAmenitiesPlaceholder: 'Write extra amenities separated by commas',
      propertyImage: 'Property image',
      uploadImage: 'Upload image',
      useImageUrl: 'Use image URL',
      chooseImage: 'Choose a property image',
      imageHint: 'PNG, JPG, or WEBP. Recommended: wide landscape photo.',
      imageUrl: 'Image URL',
      imageUrlPlaceholder: 'https://example.com/property-image.jpg',
      descriptionLabel: 'Description',
      submitted: 'Your listing has been submitted for admin review.',
      uploadRequired: 'Please upload a property image.',
      urlRequired: 'Please add an image URL.'
    },

    addActivity: enAddActivity,
    addExperience: enAddActivity,

    contact: {
      eyebrow: 'Contact',
      title: 'Tell us what you are looking for',
      description:
        'Send an inquiry for a property, activity, developer partnership, or owner listing request.',
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      message: 'Message',
      contactDetails: 'Contact details',
      submitted: 'Your inquiry has been received.'
    },

    about: {
      eyebrow: 'About',
      title: 'A cleaner marketplace for Oman’s premium property and lifestyle economy',
      description:
        'lux.om is designed around trust, presentation, and ease. Owners, buyers, renters, guests, and development companies get a polished marketplace built for serious discovery.',
      cards: [
        {
          title: 'For renters and buyers',
          text:
            'Search homes, villas, chalets, short stays, and developer-linked projects with a clear premium experience across mobile and desktop.'
        },
        {
          title: 'For owners and agents',
          text:
            'Submit listings, manage inquiries, and keep property presentation consistent through an approval-first publishing workflow.'
        },
        {
          title: 'For development companies',
          text:
            'Showcase company profiles, featured projects, and property pipelines so buyers can understand the developer behind each opportunity.'
        }
      ]
    },

    dashboard: {
      eyebrow: 'Owner dashboard',
      title: 'Manage your listings and inquiries',
      description:
        'A simplified dashboard view for owner activity, listing quality, and next actions.',
      totalListings: 'Total listings',
      pendingInquiries: 'Pending inquiries',
      profileScore: 'Profile score',
      recentListings: 'Recent listings',
      property: 'Property'
    },

    admin: {
      eyebrow: 'Admin',
      title: 'Approval workflow',
      description:
        'Review listings before they become public and keep marketplace quality consistent.',
      listingQueue: 'Listing queue',
      listing: 'Listing',
      owner: 'Owner',
      status: 'Status',
      approved: 'Approved',
      pending: 'Pending'
    }
  },

  ar: {
    common: {
      language: 'English',
      brandSubtitle: 'عمان، بانتقاء',
      listProperty: 'أضف عقارك',
      listActivity: 'أضف نشاطاً',
      listExperience: 'أضف نشاطاً',
      exploreListings: 'تصفح العقارات',
      viewActivities: 'تصفح الأنشطة',
      viewExperiences: 'تصفح الأنشطة',
      requestDetails: 'طلب التفاصيل',
      contactOwner: 'تواصل مع المالك',
      sendInquiry: 'إرسال الطلب',
      submitForReview: 'إرسال للمراجعة',
      resetFilters: 'مسح الفلاتر',
      show: 'إظهار',
      hide: 'إخفاء',
      backToListings: 'الرجوع للعقارات',
      backToActivities: 'الرجوع للأنشطة',
      backToExperiences: 'الرجوع للأنشطة',
      view: 'عرض',
      yes: 'نعم',
      no: 'لا',
      any: 'أي'
    },

    nav: {
      listings: 'العقارات',
      activities: 'الأنشطة',
      experiences: 'الأنشطة',
      developers: 'المطورون',
      about: 'من نحن',
      contact: 'تواصل معنا'
    },

    footer: {
      tagline: 'عقارات، إقامات، أنشطة، ومشاريع تطويرية فاخرة.',
      description:
        'lux.om منصة عمانية منتقاة للعقارات المعروضة للبيع، الإيجارات، الإقامات القصيرة، الأنشطة، وشركات التطوير العقاري.',
      explore: 'استكشف',
      owners: 'للملاك والشركاء',
      dashboard: 'لوحة التحكم',
      admin: 'الإدارة',
      contact: 'تواصل',
      address: 'مسقط، سلطنة عمان',
      partnerEyebrow: 'للملاك والمطورين',
      partnerTitle: 'اعرض العقارات والمشاريع المميزة على lux.om',
      partnerText:
        'أضف عقارات فردية، اعرض ملفات شركات التطوير، واربط المشترين والمستأجرين والضيوف بفرص عقارية عالية الجودة في عمان.',
      partnerWithLux: 'كن شريكاً مع lux.om',
      bottomLine: 'منصة عمان الفاخرة للعقارات ونمط الحياة'
    },

    home: {
      eyebrow: 'منصة عمان الفاخرة',
      title: 'عقارات، إقامات، أنشطة، ومشاريع مختارة في عمان.',
      description:
        'تصفح العقارات المعروضة للبيع، الإيجارات، الإقامات القصيرة، الأنشطة المحلية، وشركات التطوير الموثوقة في عمان.',
      searchPlaceholder: 'ابحث عن فلل مسقط، شاليهات السيفة، مشاريع الموج...',
      verified: 'مجموعة موثوقة',
      verifiedText: 'عقارات ومشاريع فاخرة',
      featuredHomesEyebrow: 'عقارات مميزة',
      featuredHomesTitle: 'عقارات راقية للبيع، الإيجار، والإقامة القصيرة',
      featuredHomesDescription:
        'مساحات مختارة بتفاصيل واضحة، صور عالية الجودة، وسياق موثوق عن الشركات المطورة والملاك.',
      whyEyebrow: 'لماذا lux.om',
      whyTitle: 'تجربة مبنية على الثقة من التصفح حتى إرسال الطلب',
      benefits: [
        'عقارات وملفات ملاك وشركات تطوير موثقة',
        'رحلة واضحة للإقامة القصيرة، الإيجار، البيع، والأنشطة',
        'بحث حسب المعالم والمناطق المهمة للعملاء الجادين',
        'مراجعة إدارية قبل نشر العقارات'
      ],
      activitiesEyebrow: 'الأنشطة',
      activitiesTitle: 'طرق مختارة لاكتشاف عمان',
      activitiesDescription:
        'أنشطة ورحلات وتجارب يومية فاخرة للزوار الذين يبحثون عن أكثر من مجرد مكان للإقامة.',
      experiencesEyebrow: 'الأنشطة',
      experiencesTitle: 'طرق مختارة لاكتشاف عمان',
      experiencesDescription:
        'أنشطة ورحلات وتجارب يومية فاخرة للزوار الذين يبحثون عن أكثر من مجرد مكان للإقامة.'
    },

    listings: {
      eyebrow: 'العقارات',
      title: 'ابحث عن مساحتك الفاخرة القادمة في عمان',
      description:
        'ابحث عن عقارات للبيع، الإيجار، والإقامة القصيرة بفلاتر تناسب المشترين والمستأجرين والضيوف الجادين.',
      normalFilters: 'فلاتر عادية',
      quickSearch: 'بحث سريع',
      searchPlaceholder: 'ابحث عن فيلا، شاليه، مسقط، مطور...',
      transaction: 'نوع العملية',
      propertyType: 'نوع العقار',
      location: 'الموقع',
      locationPlaceholder: 'مسقط، صلالة، السيفة...',
      advancedFilters: 'فلاتر متقدمة',
      advancedSubtitle: 'بحث دقيق بطابع فاخر',
      premiumNote:
        'استخدم الفلاتر المتقدمة لتضييق النتائج حسب المواصفات والمرافق ونمط الحياة وسياق المطور.',
      minBedrooms: 'أقل عدد غرف',
      minBathrooms: 'أقل عدد حمامات',
      minArea: 'أقل مساحة',
      priceKeyword: 'كلمة في السعر',
      amenities: 'المرافق',
      results: 'عقارات موجودة',
      result: 'عقار موجود',
      noResultsTitle: 'لا توجد عقارات',
      noResultsText: 'جرب إزالة بعض الفلاتر أو البحث في موقع أوسع.',
      normalAdvanced: 'فلاتر عادية + متقدمة',
      aboutProperty: 'عن هذا العقار',
      summary: 'ملخص العقار',
      contactHint:
        'يمكن مشاركة بيانات التواصل والاستفسار بعد تسجيل الدخول أو إرسال طلب مباشر، حسب إعدادات المالك.'
    },

    activities: arActivities,
    experiences: arActivities,

    addListing: {
      eyebrow: 'للملاك',
      title: 'أرسل عقارك للمراجعة',
      description:
        'أضف التفاصيل التي يبحث عنها المشترون والمستأجرون، بما فيها بيانات الفلاتر المتقدمة وسياق الشركة المطورة.',
      basicInfo: 'معلومات أساسية',
      propertyDetails: 'تفاصيل العقار',
      propertyTitle: 'عنوان العقار',
      type: 'النوع',
      transaction: 'نوع العملية',
      location: 'الموقع',
      locationPlaceholder: 'مسقط، الموج، صلالة...',
      price: 'السعر',
      pricePlaceholder: '٩٠٠ ر.ع / شهرياً',
      paymentFrequency: 'تكرار الدفع',
      bedrooms: 'غرف النوم',
      bathrooms: 'الحمامات',
      area: 'المساحة بالمتر',
      advancedData: 'بيانات الفلاتر المتقدمة',
      searchableSpecs: 'مواصفات يبحث عنها العملاء',
      maxGuests: 'أقصى عدد ضيوف',
      maxGuestsPlaceholder: 'للإقامات القصيرة',
      minStay: 'أقل عدد ليالي',
      minStayPlaceholder: 'للشاليهات أو الإقامات القصيرة',
      parkingSpaces: 'مواقف السيارات',
      floorNumber: 'رقم الطابق',
      floorNumberPlaceholder: 'للشقق',
      furnishing: 'التأثيث',
      view: 'الإطلالة',
      amenities: 'المرافق',
      otherAmenities: 'مرافق أخرى',
      otherAmenitiesPlaceholder: 'اكتب مرافق إضافية مفصولة بفواصل',
      propertyImage: 'صورة العقار',
      uploadImage: 'رفع صورة',
      useImageUrl: 'استخدام رابط صورة',
      chooseImage: 'اختر صورة للعقار',
      imageHint: 'PNG أو JPG أو WEBP. يفضل صورة أفقية واسعة.',
      imageUrl: 'رابط الصورة',
      imageUrlPlaceholder: 'https://example.com/property-image.jpg',
      descriptionLabel: 'الوصف',
      submitted: 'تم إرسال العقار للمراجعة الإدارية.',
      uploadRequired: 'يرجى رفع صورة للعقار.',
      urlRequired: 'يرجى إضافة رابط صورة.'
    },

    addActivity: arAddActivity,
    addExperience: arAddActivity,

    contact: {
      eyebrow: 'تواصل معنا',
      title: 'أخبرنا عمّا تبحث عنه',
      description: 'أرسل طلباً بخصوص عقار، نشاط، شراكة مطور، أو إدراج عقار.',
      name: 'الاسم',
      email: 'البريد الإلكتروني',
      phone: 'الهاتف',
      message: 'الرسالة',
      contactDetails: 'بيانات التواصل',
      submitted: 'تم استلام طلبك.'
    },

    about: {
      eyebrow: 'من نحن',
      title: 'منصة أوضح لسوق العقارات ونمط الحياة الفاخر في عمان',
      description:
        'تم تصميم lux.om حول الثقة، جودة العرض، وسهولة الاستخدام. يحصل الملاك والمشترون والمستأجرون والضيوف وشركات التطوير على منصة احترافية للاكتشاف الجاد.',
      cards: [
        {
          title: 'للمستأجرين والمشترين',
          text:
            'ابحث عن البيوت، الفلل، الشاليهات، الإقامات القصيرة، والمشاريع المرتبطة بالمطورين من خلال تجربة واضحة وراقية على الجوال والكمبيوتر.'
        },
        {
          title: 'للملاك والوكلاء',
          text:
            'أرسل العقارات، تابع الاستفسارات، وحافظ على جودة عرض العقارات من خلال نظام مراجعة قبل النشر.'
        },
        {
          title: 'لشركات التطوير',
          text:
            'اعرض ملفات الشركات والمشاريع المميزة وقوائم العقارات حتى يفهم المشترون المطور خلف كل فرصة.'
        }
      ]
    },

    dashboard: {
      eyebrow: 'لوحة المالك',
      title: 'إدارة العقارات والاستفسارات',
      description: 'عرض مبسط لنشاط المالك، جودة العقارات، والخطوات التالية.',
      totalListings: 'إجمالي العقارات',
      pendingInquiries: 'استفسارات قيد الانتظار',
      profileScore: 'درجة الملف',
      recentListings: 'آخر العقارات',
      property: 'العقار'
    },

    admin: {
      eyebrow: 'الإدارة',
      title: 'سير الموافقات',
      description: 'راجع العقارات قبل نشرها للحفاظ على جودة المنصة.',
      listingQueue: 'قائمة العقارات',
      listing: 'العقار',
      owner: 'المالك',
      status: 'الحالة',
      approved: 'مقبول',
      pending: 'قيد المراجعة'
    }
  }
} as const;