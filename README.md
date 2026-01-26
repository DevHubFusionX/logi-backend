# Blyne Logistics Backend

Node.js backend API for the Blyne Logistics Platform, powered by Express.js and Supabase.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- A Supabase project ([create one here](https://supabase.com))

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Copy the example environment file and update with your Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
PORT=5000
NODE_ENV=development

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

FRONTEND_URL=http://localhost:3000
```

### 3. Set Up Database

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migration.sql`
4. Run the SQL to create all tables

### 4. Start the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The API will be available at `http://localhost:5000`

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── supabase.js      # Supabase client setup
│   │   └── index.js         # App configuration
│   ├── controllers/         # Route handlers
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── shipmentController.js
│   │   ├── driverController.js
│   │   ├── trackingController.js
│   │   ├── supportController.js
│   │   └── analyticsController.js
│   ├── middleware/
│   │   ├── auth.js          # JWT authentication
│   │   ├── errorHandler.js  # Global error handling
│   │   └── validate.js      # Request validation
│   ├── routes/              # API routes
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── shipments.js
│   │   ├── drivers.js
│   │   ├── tracking.js
│   │   ├── support.js
│   │   ├── analytics.js
│   │   └── index.js
│   ├── utils/
│   │   ├── helpers.js       # Utility functions
│   │   └── trackingNumber.js
│   └── server.js            # Express app entry
├── supabase/
│   └── migration.sql        # Database schema
├── .env.example
├── package.json
└── README.md
```

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/logout` | Logout user |
| POST | `/api/auth/forgot-password` | Request password reset |
| GET | `/api/auth/me` | Get current user |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | Get all users (admin) |
| GET | `/api/users/:id` | Get user by ID |
| PUT | `/api/users/:id` | Update user |
| PUT | `/api/users/profile` | Update own profile |
| POST | `/api/users/change-password` | Change password |
| GET | `/api/users/addresses` | Get saved addresses |
| POST | `/api/users/addresses` | Add new address |
| DELETE | `/api/users/addresses/:id` | Delete address |
| GET | `/api/users/notifications` | Get notifications |

### Shipments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/shipments` | Get all shipments |
| POST | `/api/shipments` | Create shipment |
| GET | `/api/shipments/:id` | Get shipment by ID |
| PUT | `/api/shipments/:id` | Update shipment |
| DELETE | `/api/shipments/:id` | Delete shipment |
| GET | `/api/shipments/stats` | Get statistics |
| POST | `/api/shipments/:id/cancel` | Cancel shipment |

### Tracking
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tracking/:trackingNumber` | Track by number |
| GET | `/api/tracking/:id/timeline` | Get timeline |
| GET | `/api/tracking/:id/location` | Get live location |
| GET | `/api/tracking/:id/eta` | Get ETA |
| GET | `/api/tracking/active` | Get active shipments |

### Drivers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/drivers` | Get all drivers |
| POST | `/api/drivers` | Create driver |
| GET | `/api/drivers/:id` | Get driver by ID |
| PUT | `/api/drivers/:id` | Update driver |
| POST | `/api/drivers/:id/suspend` | Suspend driver |
| POST | `/api/drivers/:id/reactivate` | Reactivate driver |
| GET | `/api/drivers/stats` | Get driver stats |

### Support
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/support/tickets` | Get user tickets |
| POST | `/api/support/tickets` | Create ticket |
| GET | `/api/support/tickets/:id` | Get ticket by ID |
| POST | `/api/support/tickets/:id/replies` | Add reply |
| GET | `/api/support/faqs` | Get FAQs |
| POST | `/api/support/contact` | Submit contact form |

### Analytics (Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/dashboard` | Dashboard summary |
| GET | `/api/analytics/revenue` | Revenue data |
| GET | `/api/analytics/expenses` | Expense breakdown |
| GET | `/api/analytics/shipments` | Shipment stats |
| GET | `/api/analytics/regional` | Regional performance |

## 🔐 Authentication

The API uses Supabase Auth with JWT tokens. Include the token in requests:

```
Authorization: Bearer <your-jwt-token>
```

## 🛠️ Frontend Integration

Update your frontend `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## 📝 License

MIT
