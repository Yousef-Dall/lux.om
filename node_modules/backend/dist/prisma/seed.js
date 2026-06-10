"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
const password = 'Password123!';
async function main() {
    await prisma.inquiry.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.activityHighlight.deleteMany();
    await prisma.activityImage.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.listingImage.deleteMany();
    await prisma.amenity.deleteMany();
    await prisma.listing.deleteMany();
    await prisma.travelAgency.deleteMany();
    await prisma.developerCompany.deleteMany();
    await prisma.landmark.deleteMany();
    await prisma.user.deleteMany();
    const hashedPassword = await bcryptjs_1.default.hash(password, 12);
    const admin = await prisma.user.create({
        data: {
            name: 'Lux Admin',
            email: 'admin@lux.om',
            password: hashedPassword,
            role: 'ADMIN'
        }
    });
    const owner = await prisma.user.create({
        data: {
            name: 'Lux Oman Properties',
            email: 'owner@lux.om',
            password: hashedPassword,
            role: 'OWNER',
            phone: '+968 9000 0000'
        }
    });
    const activityProvider = await prisma.user.create({
        data: {
            name: 'Muscat Premium Activities',
            email: 'activities@lux.om',
            password: hashedPassword,
            role: 'ACTIVITY_PROVIDER',
            phone: '+968 9111 1111'
        }
    });
    const user = await prisma.user.create({
        data: {
            name: 'Salam User',
            email: 'user@lux.om',
            password: hashedPassword,
            role: 'USER'
        }
    });
    const mallOfOman = await prisma.landmark.create({
        data: {
            slug: 'mall-of-oman',
            nameEn: 'Mall of Oman',
            nameAr: 'مول عُمان',
            cityEn: 'Muscat',
            cityAr: 'مسقط',
            category: 'Mall'
        }
    });
    const muscatHills = await prisma.landmark.create({
        data: {
            slug: 'muscat-hills',
            nameEn: 'Muscat Hills',
            nameAr: 'مسقط هيلز',
            cityEn: 'Muscat',
            cityAr: 'مسقط',
            category: 'Residential'
        }
    });
    const developer = await prisma.developerCompany.create({
        data: {
            slug: 'omran-developments',
            nameEn: 'Omran Developments',
            nameAr: 'عمران للتطوير',
            descriptionEn: 'A premium development company creating refined residential and mixed-use destinations across Oman.',
            descriptionAr: 'شركة تطوير عقاري فاخرة تعمل على إنشاء وجهات سكنية ومتعددة الاستخدامات في عُمان.',
            headquartersEn: 'Muscat, Oman',
            headquartersAr: 'مسقط، عُمان',
            logo: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
            phone: '+968 9222 2222',
            email: 'partners@omran.example',
            website: 'https://example.com',
            establishedYear: 2012,
            verified: true,
            featured: true
        }
    });
    const muscatCoastTours = await prisma.travelAgency.create({
        data: {
            slug: 'muscat-coast-tours',
            nameEn: 'Muscat Coast Tours',
            nameAr: 'جولات ساحل مسقط',
            descriptionEn: 'A verified travel agency specializing in private coastal cruises, sea activities, and curated Muscat experiences.',
            descriptionAr: 'وكالة سفر موثوقة متخصصة في الرحلات البحرية الخاصة والأنشطة الساحلية والتجارب المختارة في مسقط.',
            headquartersEn: 'Muscat, Oman',
            headquartersAr: 'مسقط، عُمان',
            logo: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
            phone: '+968 9444 4444',
            email: 'hello@muscatcoast.example',
            website: 'https://example.com',
            establishedYear: 2018,
            verified: true,
            featured: true
        }
    });
    await prisma.travelAgency.create({
        data: {
            slug: 'oman-desert-journeys',
            nameEn: 'Oman Desert Journeys',
            nameAr: 'رحلات صحراء عُمان',
            descriptionEn: 'A boutique travel agency creating desert, mountain, and cultural journeys across Oman.',
            descriptionAr: 'وكالة سفر متخصصة في تنظيم رحلات الصحراء والجبال والتجارب الثقافية داخل عُمان.',
            headquartersEn: 'Muscat, Oman',
            headquartersAr: 'مسقط، عُمان',
            logo: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=1200&q=80',
            phone: '+968 9555 5555',
            email: 'trips@omandesert.example',
            website: 'https://example.com',
            establishedYear: 2020,
            verified: true,
            featured: false
        }
    });
    const beachfrontVilla = await prisma.listing.create({
        data: {
            slug: 'al-mouj-beachfront-villa',
            title: 'Al Mouj Beachfront Villa',
            titleEn: 'Al Mouj Beachfront Villa',
            titleAr: 'فيلا شاطئية في الموج',
            description: 'A private beachfront villa with resort-scale outdoor living, refined interiors, and uninterrupted water views.',
            descriptionEn: 'A private beachfront villa with resort-scale outdoor living, refined interiors, and uninterrupted water views.',
            descriptionAr: 'فيلا شاطئية خاصة بتصميم فاخر ومساحات خارجية واسعة وإطلالات مباشرة على المياه.',
            type: 'Villa',
            typeEn: 'Villa',
            typeAr: 'فيلا',
            transaction: 'Sale',
            location: 'Al Mouj, Muscat',
            locationEn: 'Al Mouj, Muscat',
            locationAr: 'الموج، مسقط',
            price: 'OMR 1,250,000',
            beds: 5,
            baths: 6,
            sqm: 650,
            image: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1600&q=80',
            status: 'APPROVED',
            featured: true,
            maxGuests: 10,
            parking: true,
            furnishing: 'Furnished',
            view: 'Sea view',
            paymentFrequency: 'Total sale price',
            ownerId: owner.id,
            developerId: developer.id,
            nearestLandmarkId: mallOfOman.id,
            distanceFromLandmarkEn: '12 minutes from Mall of Oman',
            distanceFromLandmarkAr: 'يبعد 12 دقيقة عن مول عُمان',
            amenities: {
                create: [
                    { name: 'Private pool', nameEn: 'Private pool', nameAr: 'مسبح خاص' },
                    { name: 'Parking', nameEn: 'Parking', nameAr: 'مواقف سيارات' },
                    { name: 'Security', nameEn: 'Security', nameAr: 'أمن' }
                ]
            },
            images: {
                create: [
                    {
                        url: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1600&q=80',
                        altEn: 'Beachfront villa exterior',
                        altAr: 'واجهة فيلا شاطئية',
                        sortOrder: 0
                    },
                    {
                        url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80',
                        altEn: 'Luxury villa living room',
                        altAr: 'غرفة معيشة فاخرة',
                        sortOrder: 1
                    }
                ]
            }
        }
    });
    await prisma.listing.create({
        data: {
            slug: 'qurum-contemporary-villa',
            title: 'Contemporary Villa',
            titleEn: 'Contemporary Villa',
            titleAr: 'فيلا عصرية',
            description: 'A calm architectural villa in Qurum with generous reception spaces and premium finishes.',
            descriptionEn: 'A calm architectural villa in Qurum with generous reception spaces and premium finishes.',
            descriptionAr: 'فيلا عصرية هادئة في القرم بمساحات استقبال واسعة وتشطيبات راقية.',
            type: 'Villa',
            typeEn: 'Villa',
            typeAr: 'فيلا',
            transaction: 'Rent',
            location: 'Qurum, Muscat',
            locationEn: 'Qurum, Muscat',
            locationAr: 'القرم، مسقط',
            price: 'OMR 2,800 /mo',
            beds: 4,
            baths: 5,
            sqm: 420,
            image: 'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1600&q=80',
            status: 'APPROVED',
            featured: true,
            parking: true,
            furnishing: 'Furnished',
            view: 'Garden view',
            paymentFrequency: 'Per month',
            ownerId: owner.id,
            nearestLandmarkId: muscatHills.id,
            distanceFromLandmarkEn: '8 minutes from Muscat Hills',
            distanceFromLandmarkAr: 'تبعد 8 دقائق عن مسقط هيلز',
            amenities: {
                create: [
                    { name: 'Garden', nameEn: 'Garden', nameAr: 'حديقة' },
                    { name: 'Parking', nameEn: 'Parking', nameAr: 'مواقف سيارات' },
                    { name: 'Maid room', nameEn: 'Maid room', nameAr: 'غرفة عاملة' }
                ]
            },
            images: {
                create: [
                    {
                        url: 'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1600&q=80',
                        altEn: 'Contemporary villa exterior',
                        altAr: 'واجهة فيلا عصرية',
                        sortOrder: 0
                    }
                ]
            }
        }
    });
    const cruiseActivity = await prisma.activity.create({
        data: {
            slug: 'private-muscat-coast-cruise',
            titleEn: 'Private Muscat Coast Cruise',
            titleAr: 'رحلة بحرية خاصة على ساحل مسقط',
            descriptionEn: 'A private coastal cruise with curated views of Muscat, flexible timing, and premium onboard service.',
            descriptionAr: 'رحلة بحرية خاصة على ساحل مسقط مع توقيت مرن وخدمة راقية على متن القارب.',
            locationEn: 'Muscat Marina',
            locationAr: 'مارينا مسقط',
            categoryEn: 'Sea activity',
            categoryAr: 'نشاط بحري',
            providerEn: 'Muscat Coast Tours',
            providerAr: 'جولات ساحل مسقط',
            price: 'From OMR 95',
            durationMinutes: 180,
            durationLabelEn: '3 hours',
            durationLabelAr: '3 ساعات',
            groupSize: 'Up to 8 guests',
            language: 'Arabic / English',
            difficulty: 'Easy',
            activityType: 'Private',
            familyFriendly: true,
            includesTransfer: false,
            mealIncluded: true,
            outdoor: true,
            status: 'APPROVED',
            featured: true,
            ownerId: activityProvider.id,
            travelAgencyId: muscatCoastTours.id,
            nearestLandmarkId: mallOfOman.id,
            distanceFromLandmarkEn: '20 minutes from Mall of Oman',
            distanceFromLandmarkAr: 'يبعد 20 دقيقة عن مول عُمان',
            images: {
                create: [
                    {
                        url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80',
                        altEn: 'Private coastal cruise',
                        altAr: 'رحلة بحرية خاصة',
                        sortOrder: 0
                    }
                ]
            },
            highlights: {
                create: [
                    {
                        textEn: 'Private boat experience',
                        textAr: 'تجربة قارب خاصة'
                    },
                    {
                        textEn: 'Sunset timing available',
                        textAr: 'إمكانية اختيار وقت الغروب'
                    },
                    {
                        textEn: 'Light refreshments included',
                        textAr: 'تشمل ضيافة خفيفة'
                    }
                ]
            }
        }
    });
    await prisma.inquiry.create({
        data: {
            type: 'PROPERTY',
            name: 'Sample Lead',
            email: 'lead@example.com',
            phone: '+968 9333 3333',
            message: 'I would like more details about this beachfront villa.',
            userId: user.id,
            listingId: beachfrontVilla.id
        }
    });
    await prisma.inquiry.create({
        data: {
            type: 'ACTIVITY',
            name: 'Sample Activity Lead',
            email: 'activity-lead@example.com',
            phone: '+968 9666 6666',
            message: 'I would like to know if the cruise is available this weekend.',
            userId: user.id,
            activityId: cruiseActivity.id
        }
    });
    console.log('Seed complete');
    console.log({
        admin: admin.email,
        owner: owner.email,
        activityProvider: activityProvider.email,
        user: user.email,
        password
    });
}
main()
    .catch((error) => {
    console.error(error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
