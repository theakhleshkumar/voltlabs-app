# VoltLabs Backend

Node.js backend API for VoltLabs IoT app with Phone/OTP authentication.

## Tech Stack

- **Express.js** - Web framework
- **MongoDB** - Database
- **Twilio** - SMS OTP
- **JWT** - Authentication

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Set Up MongoDB

**Option A: Local MongoDB**
```bash
# Install MongoDB Community Edition
# Windows: https://www.mongodb.com/try/download/community
# Start MongoDB service
```

**Option B: MongoDB Atlas (Free Cloud)**
1. Go to https://www.mongodb.com/atlas
2. Create free cluster
3. Get connection string
4. Update `MONGODB_URI` in `.env`

### 3. Configure Environment

Edit `.env` file:
```env
MONGODB_URI=mongodb://localhost:27017/voltlabs
JWT_SECRET=your-secret-key-here
```

### 4. Start Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Server runs on `http://localhost:3000`

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/send-otp` | Send OTP to phone |
| POST | `/api/auth/verify-otp` | Verify OTP & login |
| POST | `/api/auth/refresh-token` | Refresh access token |
| POST | `/api/auth/logout` | Logout (auth required) |
| GET | `/api/auth/me` | Get profile (auth required) |
| PATCH | `/api/auth/me` | Update profile (auth required) |

### Devices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices` | Get all devices |
| POST | `/api/devices` | Register device |
| GET | `/api/devices/:id` | Get single device |
| PATCH | `/api/devices/:id` | Update device |
| DELETE | `/api/devices/:id` | Delete device |

## Development Mode

Without Twilio credentials, OTP is logged to console:
```
📱 [DEV MODE] OTP for +919876543210: 123456
```

The API response also includes `devOtp` in development mode.

## Twilio Setup (Optional for Production)

1. Create account at https://www.twilio.com/try-twilio
2. Get Account SID, Auth Token, and a phone number
3. Add to `.env`:
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+15551234567
```

## Testing with React Native

For Android emulator, the API URL is:
```javascript
baseUrl: 'http://10.0.2.2:3000/api'
```

For physical device, use your computer's local IP:
```javascript
baseUrl: 'http://192.168.1.XXX:3000/api'
```
