# PlantWater - Smart Plant Care Reminders

A Next.js application that helps you care for your plants with AI-powered plant identification and smart watering reminders.

## Features

- **Plant Identification**: Upload photos and get AI-powered plant species identification
- **Smart Watering Reminders**: Personalized watering schedules based on plant needs
- **Health Monitoring**: Track your plants' health over time
- **User Authentication**: Secure multi-user support
- **Image Management**: Upload and store plant profile pictures
- **AI-Powered Care Advice**: Get detailed care instructions for each plant

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: SQLite with Prisma ORM
- **Authentication**: NextAuth.js
- **AI Integration**: OpenAI GPT-4V for plant identification
- **Image Storage**: Mock cloud storage (local files for prototype)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables in `.env`:
   ```env
   DATABASE_URL="file:./dev.db"
   # NextAuth Configuration
   NEXTAUTH_URL="http://localhost:3001"
   NEXTAUTH_SECRET="your-nextauth-secret-key-here"
   # CSRF Protection - Comma-separated list of allowed origins
   # In production, set this to your actual domain(s)
   ALLOWED_ORIGINS="http://localhost:3000,https://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,https://localhost:3001,http://127.0.0.1:3001"
   # OpenAI Configuration
   OPENAI_API_KEY="your-openai-api-key-here"
   # Image Upload Configuration (for production cloud service)
   CLOUD_STORAGE_ENDPOINT="your-cloud-storage-endpoint"
   CLOUD_STORAGE_BUCKET="your-bucket-name"
   ```

   **Note**: For development, OpenAI API calls are mocked by default. See [Development vs Production](#development-vs-production) section below.

3. Set up the database:
   ```bash
   npx prisma db push
   npx prisma generate
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to view the app.

## Development vs Production

### Mock Services (Development)

The application uses mock services during development to avoid API costs and provide consistent responses:

- **OpenAI Integration**: Returns realistic mock plant identification and health analysis data
- **File Storage**: Stores images locally in `/public/uploads/` instead of cloud storage

### Switching to Production

To use real services in production:

1. **OpenAI API**: Set environment variable `USE_MOCK_OPENAI=false` or deploy with `NODE_ENV=production`
2. **Cloud Storage**: Uncomment and configure the cloud storage service in `src/lib/cloudStorage.ts`

### Mock Data

The app includes realistic mock data for:
- Plant identification (6 common houseplants)
- Health analysis (5 different health scenarios)
- Simulated API delays for realistic UX testing

## API Routes

- `/api/auth/*` - NextAuth.js authentication endpoints
- `/api/plants` - CRUD operations for plants
- `/api/identify` - AI plant identification (mocked in development)
- `/api/analyze` - Plant health analysis (mocked in development)
- `/api/upload` - Image upload handling

## License

This project is licensed under the MIT License.
