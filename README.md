# Smart Shrimp Farm Management System (SSFM)

This repository contains the source code for the SSFM project, including the Backend (NestJS), Web App (React Vite), Mobile App (Expo), and AI Service (Python FastAPI).

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v20+)
- Python (v3.10+)
- Docker & Docker Compose

### 2. Run Database
```bash
docker-compose up -d
```
This will start PostgreSQL on port `5432` and Redis on port `6379`.

### 3. Backend (NestJS)
```bash
cd backend
npm install
npm run start:dev
```
Don't forget to configure your `.env` with the `DATABASE_URL` and run `npx prisma db push` or `npx prisma migrate dev`.

### 4. Frontend Web (React + Vite)
```bash
cd frontend-web
npm install
npm run dev
```

### 5. Frontend Mobile (Expo)
```bash
cd frontend-mobile
npm install
npm start
```

### 6. AI Service (Python FastAPI)
```bash
cd ai-service
# Activate venv
# Windows: .\venv\Scripts\activate
# Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
