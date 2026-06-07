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
    await prisma.payment.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.amenity.deleteMany();
    await prisma.listing.deleteMany();
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
    await prisma.user.create({
        data: {
            name: 'Salam User',
            email: 'user@lux.om',
            password: hashedPassword,
            role: 'USER'
        }
    });
    await prisma.listing.createMany({
        data: [
            {
                slug: 'al-mouj-beachfront-villa',
                title: 'Al Mouj Beachfront Villa',
                description: 'A private beachfront villa with resort-scale outdoor living, refined interiors, and uninterrupted water views.',
                type: 'Villa',
                transaction: 'Sale',
                location: 'Al Mouj, Muscat',
                price: 'OMR 1,250,000',
                beds: 5,
                baths: 6,
                sqm: 650,
                image: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1600&q=80',
                status: 'APPROVED',
                ownerId: owner.id
            },
            {
                slug: 'qurum-contemporary-villa',
                title: 'Contemporary Villa',
                description: 'A calm architectural villa in Qurum with generous reception spaces and premium finishes.',
                type: 'Villa',
                transaction: 'Rent',
                location: 'Qurum, Muscat',
                price: 'OMR 2,800 /mo',
                beds: 4,
                baths: 5,
                sqm: 420,
                image: 'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1600&q=80',
                status: 'APPROVED',
                ownerId: owner.id
            }
        ]
    });
    const createdListings = await prisma.listing.findMany();
    await Promise.all(createdListings.map((listing) => prisma.amenity.createMany({
        data: ['Private pool', 'Parking', 'Security'].map((name) => ({
            name,
            listingId: listing.id
        }))
    })));
    console.log('Seed complete', {
        admin: admin.email,
        owner: owner.email,
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
