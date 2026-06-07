# lux.om

Premium Oman real estate, short-stay, and curated experiences marketplace.

## Requirements

- Node.js 20+
- PostgreSQL 14+
- npm 10+

## Setup

```bash
npm install
cp backend/.env.example backend/.env
npm run db:migrate -- --name init
npm run db:seed
npm run dev