# Backend (NestJS + Prisma)
API CRM (NestJS) + PostgreSQL (Prisma) + WebSocket notifications.

## Prérequis
- Node.js 20+
- Docker Desktop (pour PostgreSQL) ou une instance PostgreSQL accessible

## Démarrage rapide
### 1) Base de données (PostgreSQL)
Depuis le dossier `backend/`:

```bash
docker compose up -d
```

PostgreSQL: `localhost:5432` (user/pass/db: `crm` / `crm` / `crm`).

### 2) Installation + migrations + seed
```bash
npm install
cp .env.example .env
npx prisma migrate deploy
npx prisma db seed
```

Compte seed par défaut : `admin@example.com` / `Admin123!`

### 3) Lancer l’API
```bash
npm run dev
```

- API : `http://localhost:3001`
- Swagger : `http://localhost:3001/api`
- Health : `http://localhost:3001/health`

## Scripts utiles
- `npm run lint`
- `npm run build`
- `npm run prisma:studio`
