# Ribbon Backend

A production-ready Express.js backend API designed to power the Ribbon Admin Dashboard. This service provides robust RESTful endpoints with enterprise-grade security, validation, and scalability.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Environment Configuration](#environment-configuration)
- [Development](#development)
- [Deployment](#deployment)
- [Security](#security)
- [License](#license)

---

## 🎯 Overview

Ribbon Backend is a comprehensive Express.js API that handles authentication, data management, and business logic for the Ribbon Admin Dashboard. It provides secure, scalable endpoints built with modern Node.js best practices.

**Key Capabilities:**
- RESTful API architecture
- JWT-based authentication
- Request validation and error handling
- Database integration
- Role-based access control
- Comprehensive logging

---

## ✨ Features

### Core Framework
- **⚡ Express.js** — Lightweight and flexible web framework
- **🔐 Security** — JWT authentication, CORS, rate limiting, input sanitization
- **🗄️ Database Integration** — Optimized queries and connection pooling
- **📝 Logging** — Structured logging for monitoring and debugging
- **🧪 Testing** — Comprehensive unit and integration tests
- **📚 API Documentation** — Auto-generated API docs with Swagger/OpenAPI
- **⚙️ Error Handling** — Centralized error management and reporting
- **🔄 Middleware Stack** — Request validation, compression, authentication

### Developer Experience
- **🛠️ Hot Reload** — Automatic server restart on file changes
- **📊 Request Profiling** — Performance monitoring and analysis
- **🐛 Debugging** — Integrated debugging tools and utilities
- **📋 Type Safety** — Full TypeScript support (if applicable)
- **🎯 Code Quality** — ESLint, Prettier, and pre-commit hooks

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** ≥ 18.x (LTS recommended)
- **npm** ≥ 9.x or **yarn** ≥ 1.22.x
- **Git** ≥ 2.0
- **Docker** (optional, for containerized deployment)

### Optional Requirements
- **PostgreSQL/MySQL** — For relational database support
- **Redis** — For caching and session management
- **MongoDB** — For NoSQL data storage (if applicable)

---

## 🚀 Getting Started

### Installation

1. Clone the repository:
```bash
git clone https://github.com/arhamimran324/ribbon_backend.git
cd ribbon_backend
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Configure environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

4. Start the development server:
```bash
npm run dev
# or
yarn dev
```

5. The API will be available at:
```
http://localhost:3001
```

### Verify Installation

Test the server health endpoint:
```bash
curl http://localhost:3001/health
```

---

## 📁 Project Structure

```
ribbon_backend/
├── src/
│   ├── controllers/       # Route handlers and business logic
│   ├── models/            # Database models and schemas
│   ├── routes/            # API route definitions
│   ├── middleware/        # Express middleware (auth, validation, etc.)
│   ├── services/          # Business logic and utilities
│   ├── validators/        # Request validation schemas
│   ├── utils/             # Helper functions and utilities
│   ├── config/            # Configuration files
│   ├── constants/         # Application constants
│   └── index.js           # Application entry point
├── tests/                 # Test suites (unit and integration)
├── docs/                  # API documentation
├── .env.example           # Environment variables template
├── .eslintrc.json         # ESLint configuration
├── .prettierrc             # Prettier configuration
├── package.json           # Dependencies and scripts
└── README.md              # This file
```

---

## 🔌 API Documentation

### Base URL
```
http://localhost:3001/api/v1
```

### Authentication

All protected endpoints require a Bearer token in the Authorization header:

```bash
Authorization: Bearer <your_jwt_token>
```

### Core Endpoints

#### Health Check
```
GET /health
Response: { status: "ok", timestamp: "2024-01-10T12:00:00Z" }
```

#### Authentication
```
POST /api/v1/auth/login
POST /api/v1/auth/register
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
```

### API Documentation Tools

- **Swagger UI** — Available at `http://localhost:3001/api/docs`
- **Postman Collection** — Import from `docs/postman-collection.json`
- **OpenAPI Specification** — Located at `docs/openapi.yaml`

For detailed endpoint documentation, visit the Swagger UI or review [API_DOCS.md](./docs/API_DOCS.md).

---

## ⚙️ Environment Configuration

Create a `.env.local` file in the project root:

```env
# Server Configuration
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ribbon_db
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRY=24h
REFRESH_TOKEN_EXPIRY=7d

# CORS
CORS_ORIGIN=http://localhost:3000
CORS_CREDENTIALS=true

# External APIs
API_KEY=your_api_key
THIRD_PARTY_SERVICE_URL=https://api.example.com

# Mail Configuration (if applicable)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_password
```

---

## 🛠 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm run test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate test coverage report |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run lint:fix` | Fix linting issues automatically |

---

## 👥 Development

### Running Tests

```bash
# Run all tests
npm run test

# Run specific test file
npm run test -- users.test.js

# Run with coverage
npm run test:coverage
```

### Code Quality

Before committing, the following checks are enforced:

```bash
# Run linter
npm run lint

# Format code
npm run format
```

### Database Migrations

```bash
# Create migration
npm run migrate:create migration_name

# Run migrations
npm run migrate:up

# Rollback migrations
npm run migrate:down
```

---

## 🐳 Deployment

### Docker

Build and run the application in a Docker container:

```bash
# Build image
docker build -t ribbon-backend:latest .

# Run container
docker run -p 3001:3001 --env-file .env.production ribbon-backend:latest
```

### Docker Compose

```bash
docker-compose up -d
```

### Production Deployment

1. Build the application:
```bash
npm run build
```

2. Set production environment variables in `.env.production`

3. Start the server:
```bash
NODE_ENV=production npm start
```

4. Configure reverse proxy (Nginx/Apache) for SSL/TLS

5. Monitor with process manager (PM2 recommended):
```bash
pm2 start src/index.js --name ribbon-backend
```

---

## 🔒 Security

### Best Practices Implemented

- ✅ **JWT Authentication** — Secure token-based authentication
- ✅ **CORS Protection** — Configurable cross-origin policies
- ✅ **Rate Limiting** — Prevent abuse and brute force attacks
- ✅ **Input Validation** — Sanitize and validate all requests
- ✅ **SQL Injection Prevention** — Parameterized queries
- ✅ **HTTPS/TLS** — Encrypted transport in production
- ✅ **Environment Variables** — Sensitive data never hardcoded
- ✅ **Helmet.js** — HTTP header security

### Security Checklist

- [ ] Update all dependencies regularly
- [ ] Use strong JWT secret (min 32 characters)
- [ ] Enable HTTPS in production
- [ ] Configure proper CORS origins
- [ ] Set secure cookie flags
- [ ] Implement rate limiting
- [ ] Enable request logging
- [ ] Regular security audits

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Code Style** — Follow ESLint configuration
2. **Commits** — Use Conventional Commits format
3. **Testing** — Write tests for new features
4. **Documentation** — Update docs for API changes

Example commit message:
```
feat(auth): implement JWT refresh token rotation
fix(users): resolve duplicate email validation issue
docs: update API authentication guide
```

---

## 📞 Support & Issues

For bugs, feature requests, or questions:

- Open an [issue](https://github.com/arhamimran324/ribbon_backend/issues) on GitHub
- Check existing issues for similar problems
- Provide detailed reproduction steps

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE.md](LICENSE.md) file for full details.

---

## 🚀 Performance Considerations

- Connection pooling for database queries
- Redis caching for frequently accessed data
- Request compression (gzip)
- Async/await for non-blocking operations
- Load balancing support via stateless API design

---

## 📊 Monitoring

For production monitoring:

- Application logs — Stored in `logs/` directory
- Error tracking — Integrate with Sentry
- Performance metrics — Monitor with New Relic or DataDog
- Health checks — Configure uptime monitoring

---

<div align="center">
  <sub>Built with ❤️ for backend excellence</sub>
</div>
