# Material Management System (MMS)

Enterprise-grade Material Movement Tracking System built with the MERN Stack.

## Tech Stack

- **Frontend:** React 18 + Vite + Tailwind CSS v4
- **Backend:** Node.js + Express.js
- **Database:** MongoDB + Mongoose
- **Auth:** JWT + Refresh Tokens
- **Real-time:** Socket.IO
- **File Storage:** Cloudinary
- **Excel:** ExcelJS
- **Geo/Camera:** Browser Geolocation + MediaDevices API

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Cloudinary account

### Installation

```bash
npm run install:all
```

### Environment Setup

Copy `.env.example` to `.env` in the `server/` directory and fill in your values.

### Development

```bash
npm run dev
```

This starts both the backend (port 5000) and frontend (port 5173) concurrently.

### Seed Database

```bash
npm run seed
```

Creates default Super Admin and sample master data.

> You will be prompted to change the password on first login.
