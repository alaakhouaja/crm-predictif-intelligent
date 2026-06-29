# CRM Prédictif — Documentation Technique Complète
> Projet de Fin d'Études (PFE) — Application CRM avec Intelligence Artificielle intégrée

---

## Table des matières

1. [Présentation du projet](#1-présentation-du-projet)
2. [Architecture globale](#2-architecture-globale)
3. [Stack technologique](#3-stack-technologique)
4. [Structure des répertoires](#4-structure-des-répertoires)
5. [Base de données](#5-base-de-données)
6. [Backend — API REST](#6-backend--api-rest)
7. [Intégration Intelligence Artificielle](#7-intégration-intelligence-artificielle)
8. [Notifications temps réel (WebSocket)](#8-notifications-temps-réel-websocket)
9. [Interface Frontend](#9-interface-frontend)
10. [Sécurité](#10-sécurité)
11. [Fonctionnalités avancées](#11-fonctionnalités-avancées)
12. [Configuration et déploiement](#12-configuration-et-déploiement)
13. [Dépendances complètes](#13-dépendances-complètes)

---

## 1. Présentation du projet

### 1.1 Contexte

Le CRM Prédictif est une application web full-stack de gestion de la relation client (Customer Relationship Management) conçue pour les équipes commerciales. Elle intègre un moteur d'intelligence artificielle local (Ollama + Llama 3.1) pour scorer automatiquement les prospects et suggérer des actions commerciales adaptées.

### 1.2 Objectifs

- **Centraliser** la gestion des prospects (leads) et des interactions commerciales
- **Prédire** la probabilité de conversion de chaque prospect grâce à l'IA
- **Automatiser** les suggestions de tâches commerciales
- **Visualiser** les performances en temps réel via un dashboard analytique
- **Notifier** les équipes en temps réel via WebSocket

### 1.3 Utilisateurs cibles

| Rôle | Description | Accès |
|------|-------------|-------|
| **ADMIN** | Administrateur système | Accès total |
| **SALES** | Commercial | Ses leads uniquement |
| **MARKETING** | Équipe marketing | Import/export leads |
| **EXECUTIVE** | Direction | Vue analytique complète |

### 1.4 Fonctionnalités principales

- Gestion complète des prospects avec pipeline de vente en 6 étapes
- Scoring IA automatique des leads via LLM local (Ollama)
- Suggestions de tâches commerciales générées par l'IA
- Vue Kanban drag-and-drop du pipeline
- Import/Export CSV avec détection intelligente des doublons
- Gestion des tâches avec pièces jointes, rappels, et progression
- Journal d'audit complet des actions utilisateurs
- Notifications temps réel via WebSocket
- Dashboard analytique avec graphiques de tendance SVG
- Templates de tâches prédéfinis
- Actions en masse sur les leads

---

## 2. Architecture globale

### 2.1 Schéma d'architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (Navigateur)                      │
│                                                              │
│   React 19 + TypeScript + Vite                              │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│   │Dashboard │  │  Leads   │  │  Tasks   │  │ Pipeline │  │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                              │
│   HTTP/REST (fetch)          WebSocket (Socket.IO)          │
└──────────────┬───────────────────────┬──────────────────────┘
               │                       │
               ▼                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (NestJS 10)                       │
│                                                              │
│  ┌───────┐ ┌───────┐ ┌─────────┐ ┌──────────┐ ┌────────┐  │
│  │ Auth  │ │ Leads │ │  Tasks  │ │Dashboard │ │  IA    │  │
│  └───────┘ └───────┘ └─────────┘ └──────────┘ └────────┘  │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌────────────┐   │
│  │  Users   │ │Interactions│ │Notifs    │ │   Audit    │   │
│  └──────────┘ └───────────┘ └──────────┘ └────────────┘   │
│                                                              │
│  Guards: JWT + RBAC    Interceptors: Audit                   │
│  Filters: GlobalException  Middleware: RequestId             │
│  Rate Limiting: 100 req/min/IP                               │
└───────────────────┬──────────────────┬──────────────────────┘
                    │                  │
          ┌─────────▼──────┐  ┌───────▼──────────┐
          │   PostgreSQL    │  │   Ollama (Local)  │
          │   (Prisma ORM)  │  │   llama3.1 LLM   │
          └────────────────┘  └──────────────────┘
```

### 2.2 Pattern architectural

- **Backend** : Architecture modulaire NestJS (Module / Controller / Service)
- **Frontend** : Architecture par pages avec contexte React (AuthContext)
- **Communication** : REST API + WebSocket bidirectionnel
- **Persistance** : PostgreSQL via Prisma ORM (migrations versionnées)
- **IA** : LLM local via Ollama (aucune dépendance cloud)

### 2.3 Flux de données principal

```
Utilisateur → Action Frontend
    → API REST (JWT auth)
    → Guard (rôle vérifié)
    → Service (logique métier)
    → Prisma (base de données)
    → AuditLog (journalisation)
    → WebSocket (notification temps réel)
    → Réponse JSON
```

---

## 3. Stack technologique

### 3.1 Backend

| Technologie | Version | Rôle |
|-------------|---------|------|
| **NestJS** | 10.x | Framework Node.js modulaire |
| **TypeScript** | 5.1.x | Langage typé |
| **PostgreSQL** | 14+ | Base de données relationnelle |
| **Prisma ORM** | 5.22.x | ORM avec migrations |
| **Passport.js + JWT** | — | Authentification |
| **Socket.IO** | 4.8.x | WebSocket temps réel |
| **Multer** | 2.1.x | Upload de fichiers |
| **Swagger/OpenAPI** | 7.4.x | Documentation API |
| **@nestjs/throttler** | 6.5.x | Rate limiting (100 req/min/IP) |
| **bcrypt** | 6.x | Hachage mots de passe |
| **csv-parser** | 3.2.x | Import CSV |
| **class-validator** | 0.14.x | Validation des DTOs |

### 3.2 Frontend

| Technologie | Version | Rôle |
|-------------|---------|------|
| **React** | 19.2.x | Bibliothèque UI |
| **TypeScript** | 5.9.x | Langage typé |
| **Vite** | 8.x | Build tool ultra-rapide |
| **React Router DOM** | 7.13.x | Routage client-side |
| **Framer Motion** | 12.38.x | Animations fluides |
| **Lucide React** | 1.7.x | Bibliothèque d'icônes |
| **@hello-pangea/dnd** | 18.x | Drag & Drop (Kanban) |
| **Socket.IO Client** | 4.8.x | Client WebSocket |

### 3.3 Intelligence Artificielle

| Technologie | Rôle |
|-------------|------|
| **Ollama** | Serveur LLM local (localhost:11434) |
| **Llama 3.1 (8B)** | Modèle de langage pour le scoring |
| **Cache mémoire** | TTL 20 min, max 500 entrées |

---

## 4. Structure des répertoires

### 4.1 Backend (`/backend/src`)

```
backend/src/
├── auth/                          # Module d'authentification
│   ├── decorators/
│   │   ├── roles.decorator.ts     # Décorateur @Roles(...)
│   │   └── current-user.decorator.ts
│   ├── dto/
│   │   ├── login.dto.ts
│   │   ├── register.dto.ts
│   │   └── me.dto.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
├── leads/                         # Module prospects
│   ├── dto/
│   ├── leads.controller.ts
│   ├── leads.service.ts           # Logique métier + déclenchement IA
│   └── leads.module.ts
├── tasks/                         # Module tâches
│   ├── dto/
│   ├── tasks.controller.ts
│   ├── tasks.service.ts           # CRUD + notifications
│   ├── tasks.reminders.runner.ts  # Job de rappels automatiques
│   └── tasks.module.ts
├── users/                         # Module utilisateurs
│   ├── dto/
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── users.module.ts
├── dashboard/                     # Module analytics
│   ├── dashboard.controller.ts
│   ├── dashboard.service.ts       # Agrégations + alertes
│   └── dashboard.module.ts
├── interactions/                  # Module interactions
│   ├── dto/
│   ├── interactions.controller.ts
│   ├── interactions.service.ts
│   └── interactions.module.ts
├── notifications/                 # Module notifications
│   ├── notifications.gateway.ts   # WebSocket Gateway
│   ├── notifications.controller.ts
│   ├── notifications.service.ts
│   └── notifications.module.ts
├── audit/                         # Module journal d'audit
│   ├── audit.controller.ts
│   ├── audit.service.ts
│   └── audit.module.ts
├── ia/                            # Module IA (Ollama)
│   └── ia.service.ts             # Cache + Prompt + Parsing JSON
├── common/                        # Code transversal
│   ├── enums/user-role.enum.ts
│   ├── filters/all-exceptions.filter.ts
│   ├── interceptors/audit.interceptor.ts
│   └── middleware/request-id.middleware.ts
├── prisma/
│   ├── prisma.service.ts
│   └── prisma.module.ts
├── app.module.ts                  # Module racine
└── main.ts                        # Point d'entrée + Swagger + CORS
```

### 4.2 Frontend (`/frontend/src`)

```
frontend/src/
├── pages/
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx          # Analytics + SVG charts
│   ├── LeadsPage.tsx              # Page principale (1700+ lignes)
│   ├── TasksPage.tsx              # Tâches + Kanban + Attachments
│   ├── PipelineView.tsx           # Vue Kanban drag & drop
│   ├── UsersPage.tsx              # Administration
│   ├── ProfilePage.tsx
│   ├── SettingsPage.tsx
│   ├── AuditPage.tsx              # Journal audit (ADMIN)
│   └── NotFoundPage.tsx
├── components/
│   ├── AppLayout.tsx              # Sidebar + Header + Navigation
│   ├── ErrorBoundary.tsx
│   ├── NotificationBell.tsx       # Cloche temps réel
│   └── ToastProvider.tsx
├── auth/
│   └── AuthContext.tsx            # Contexte global (user + photoSrc)
├── api/
│   └── client.ts                  # Client HTTP avec JWT
├── utils/
│   ├── datetime.ts
│   └── profilePhoto.ts
├── types.ts                       # Interfaces TypeScript partagées
├── App.tsx                        # Routeur + routes protégées
└── App.css                        # Styles globaux (CSS variables)
```

---

## 5. Base de données

### 5.1 Schéma relationnel

```
User ──(owner)──── Lead
 │                  │
 ├── Interaction ───┘ (leadId)
 ├── AuditLog
 ├── Notification
 └── Task ──(leadId)── Lead
      └── TaskAttachment
```

### 5.2 Enums

```prisma
enum UserRole    { ADMIN | SALES | MARKETING | EXECUTIVE }
enum LeadStage   { Nouveau | Contacte | Qualifie | Proposition | Gagne | Perdu }
enum TaskType    { CALL | EMAIL | MEETING | TODO }
enum TaskStatus  { OPEN | IN_PROGRESS | DONE | CANCELED }
enum TaskPriority{ LOW | MEDIUM | HIGH }
enum InteractionType { EMAIL | CALL | MEETING | NOTE }
```

### 5.3 Modèles détaillés

#### User
```
id               UUID (PK)
email            String UNIQUE
passwordHash     String
firstName        String?
lastName         String?
phone            String?
profilePhotoPath String?
role             UserRole @default(SALES)
createdAt        DateTime
updatedAt        DateTime
```

#### Lead
```
id                    UUID (PK)
firstName, lastName   String
email                 String
phone                 String?
company               String?
source                String?
stage                 LeadStage @default(Nouveau)
score                 Float?    (0-10, issu du score IA / 10)
conversionProbability Float?    (0.0 à 1.0)
notes                 String?
ownerId               UUID (FK → User)
consentDate           DateTime? (RGPD)
dataOrigin            String?
isAnonymized          Boolean @default(false)
createdAt, updatedAt  DateTime

Index: ownerId, email, stage
```

#### Task
```
id               UUID (PK)
title            String
description      String?
type             TaskType @default(TODO)
status           TaskStatus @default(OPEN)
priority         TaskPriority @default(MEDIUM)
progress         Int @default(0)   (0-100%)
dueDate          DateTime?
completedAt      DateTime?
leadId           UUID? (FK → Lead)
assignedToId     UUID? (FK → User)
createdById      UUID (FK → User)
overdueNotifiedAt   DateTime?
reminderNotifiedAt  DateTime?
createdAt, updatedAt DateTime

Index: leadId, assignedToId, status, dueDate
```

#### AuditLog
```
id         UUID (PK)
userId     UUID (FK → User)
action     String  (CREATE | UPDATE | DELETE | ARCHIVE | ATTACH ...)
entityType String  (Lead | Task | User)
entityId   UUID
oldValue   Json?
newValue   Json?
createdAt  DateTime

Index: userId, entityId
```

#### Notification
```
id        UUID (PK)
userId    UUID (FK → User)
title     String
content   String
read      Boolean @default(false)
createdAt DateTime

Index: userId
```

### 5.4 Gestion des migrations

```bash
npx prisma migrate dev --name description_migration  # développement
npx prisma migrate deploy                             # production
npx prisma studio                                     # interface graphique
```

---

## 6. Backend — API REST

### 6.1 Auth (`/auth`)

| Méthode | Route | Auth requis | Description |
|---------|-------|-------------|-------------|
| POST | `/auth/bootstrap` | Non | Créer 1er admin (DB vide) |
| POST | `/auth/login` | Non | Connexion → cookie JWT |
| POST | `/auth/logout` | JWT | Déconnexion |
| POST | `/auth/register` | ADMIN | Créer un utilisateur |
| GET | `/auth/me` | JWT | Profil courant |
| PATCH | `/auth/me` | JWT | Modifier profil |
| POST | `/auth/me/photo` | JWT | Upload photo |
| GET | `/auth/me/photo` | JWT | Récupérer photo |
| POST | `/auth/change-password` | JWT | Changer mot de passe |

### 6.2 Leads (`/leads`)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/leads` | JWT | Créer prospect |
| POST | `/leads/import` | JWT | Import CSV (max 5MB) |
| POST | `/leads/webhook` | Secret | Formulaire externe |
| POST | `/leads/:id/archive` | ADMIN | Anonymiser (RGPD) |
| POST | `/leads/:id/unarchive` | ADMIN | Restaurer |
| GET | `/leads/export-ai` | JWT | Export CSV dataset IA |
| GET | `/leads` | JWT | Lister avec filtres |
| GET | `/leads/:id` | JWT | Détail |
| GET | `/leads/:id/activity` | JWT | Historique |
| GET | `/leads/:id/prediction` | JWT | Score IA + suggestions |
| PATCH | `/leads/:id` | JWT | Modifier |
| DELETE | `/leads/:id` | JWT | Supprimer |

**Filtres `GET /leads`** : `stage`, `ownerId`, `search`, `archived`, `page`, `limit`, `startDate`, `endDate`

**Réponse `GET /leads/:id/prediction`** :
```json
{
  "score": 72,
  "probability": 0.72,
  "label": "Élevée",
  "justification": "Le prospect présente un bon niveau d'engagement...",
  "nextAction": "Planifier une démonstration cette semaine.",
  "suggestedTasks": [
    {
      "title": "Démonstration produit",
      "type": "MEETING",
      "priority": "HIGH",
      "dueInDays": 3,
      "description": "Présenter la solution lors d'un appel vidéo."
    }
  ]
}
```

**Réponse `POST /leads/import`** :
```json
{
  "addedCount": 12,
  "existingCount": 3,
  "errorCount": 1,
  "duplicates": [
    { "email": "j.dupont@acme.fr", "firstName": "Jean", "lastName": "Dupont", "reason": "email" },
    { "email": "m.martin@corp.fr", "firstName": "Marie", "lastName": "Martin", "reason": "phone" },
    { "email": "a.durand@test.fr", "firstName": "Alice", "lastName": "Durand", "reason": "name" }
  ]
}
```

### 6.3 Tasks (`/tasks`)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/tasks` | Créer + notifier l'assigné |
| GET | `/tasks` | Lister (filtres multiples) |
| GET | `/tasks/stats` | Total / complétées / retard / HIGH |
| GET | `/tasks/:id` | Détail |
| PATCH | `/tasks/:id` | Modifier |
| DELETE | `/tasks/:id` | Supprimer |
| GET | `/tasks/:id/activity` | Historique |
| GET | `/tasks/:id/attachments` | Lister fichiers |
| POST | `/tasks/:id/attachments` | Upload (max 10MB) |
| GET | `/tasks/attachments/:id/download` | Télécharger |
| DELETE | `/tasks/attachments/:id` | Supprimer fichier |

**Notification automatique** : si `assignedToId ≠ createdById` → notification WebSocket instantanée avec titre, priorité et lead associé.

### 6.4 Dashboard (`/dashboard`)

| Route | Description | Donnée retournée |
|-------|-------------|-----------------|
| `/dashboard/overview` | KPIs globaux | total, won, lost, conversionRate, avgScore |
| `/dashboard/pipeline` | Métriques par étape | count + percentage par stage |
| `/dashboard/by-source` | Par source | source, count, percentage |
| `/dashboard/by-owner` | Par commercial | nom, total, won, lost, conversionRate |
| `/dashboard/trends?days=30` | Évolution temporelle | date, created, won, lost par jour |
| `/dashboard/activity?limit=10` | Activité récente | interactions + audit (noms résolus) |
| `/dashboard/stage-conversion` | Entonnoir | taux de passage entre étapes |
| `/dashboard/alerts` | Alertes | leads inactifs (>7j) + tâches HIGH en retard |

### 6.5 Users (`/users`)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/users` | ADMIN | Créer utilisateur |
| GET | `/users` | ADMIN/EXEC | Lister |
| GET | `/users/:id` | ADMIN | Détail |
| PATCH | `/users/:id` | ADMIN | Modifier |
| DELETE | `/users/:id` | ADMIN | Supprimer |

### 6.6 Audit (`/audit-logs`)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/audit-logs` | ADMIN | Journal complet paginé |

**Filtres** : `entityType`, `entityId`, `userId`, `action`, `page`, `limit` (max 50)

### 6.7 Rate limiting global

```typescript
ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])
// 100 requêtes maximum par minute par adresse IP
// Appliqué globalement via APP_GUARD
```

---

## 7. Intégration Intelligence Artificielle

### 7.1 Vue d'ensemble

```
Lead créé / importé / backend démarré
        │
        ▼ (fire-and-forget, non bloquant)
computeAndSaveScore(leadId)
        │
        ├── Prisma: charger lead + interactions + tâches
        │
        ├── Vérifier cache (clé = leadId:timestamp:stage)
        │       └── HIT → retour immédiat (< 1ms)
        │       └── MISS → continuer
        │
        ├── IaService.predictLead(features)
        │       └── POST http://localhost:11434/api/generate
        │               model: llama3.1
        │               temperature: 0.1
        │               num_predict: 400 tokens
        │               num_ctx: 2048
        │               format: json
        │               timeout: 45s
        │
        ├── Parse JSON + normalisation
        │
        └── Prisma: update lead.score + lead.conversionProbability
```

### 7.2 Déclenchement automatique

| Événement | Délai | Comportement |
|-----------|-------|-------------|
| Démarrage backend | Immédiat | Score les 50 leads sans score (400ms entre chaque) |
| Création lead (manuel) | Après réponse HTTP | Score en background |
| Import CSV | Après création | Score tous les nouveaux leads (300ms entre chaque) |
| Webhook | Après réponse | Score en background |
| Clic utilisateur | Synchrone | Recalcul forcé + réponse directe |

### 7.3 Paramètres Ollama optimisés

| Paramètre | Valeur | Raison |
|-----------|--------|--------|
| `temperature` | 0.1 | Réponses déterministes et rapides |
| `num_predict` | 400 | Notre JSON tient en ~250 tokens |
| `num_ctx` | 2048 | Moins de VRAM → inférence plus rapide |

### 7.4 Features d'entrée (LeadPredictionFeatures)

```typescript
{
  // Identité
  firstName: string;       lastName: string;
  company: string | null;  source: string | null;
  stage: string;           notes: string | null;

  // Engagement (interactions)
  interactionCount: number;
  callCount: number;    emailCount: number;    meetingCount: number;

  // Tâches
  taskCount: number;
  completedTaskCount: number;
  overdueTaskCount: number;  // Signal négatif fort

  // Temporel
  daysSinceCreation: number;
  daysSinceLastActivity: number;
}
```

### 7.5 Système de cache intelligent

```typescript
// Clé = leadId + timestamp dernière activité + étape
const cacheKey = `${leadId}:${lastActivityAt.getTime()}:${lead.stage}`;

// La clé change automatiquement si :
// - Nouvelle interaction ajoutée
// - Stade du lead modifié
// - Tâche créée ou complétée
// → Invalidation naturelle sans logique supplémentaire
```

- **TTL** : 20 minutes
- **Capacité** : 500 entrées max (FIFO eviction)
- **Gain de performance** : réponse instantanée si les données n'ont pas changé

### 7.6 Classification du score

| Score | Label | Signification |
|-------|-------|---------------|
| 70 – 100 | **Élevée** 🟢 | Lead chaud, action prioritaire |
| 40 – 69 | **Moyenne** 🟡 | Lead à suivre activement |
| 0 – 39 | **Faible** 🔴 | Lead froid |

Le score est stocké en base divisé par 10 (`score = iaScore / 10`) pour rester sur l'échelle 0–10 historique.

---

## 8. Notifications temps réel (WebSocket)

### 8.1 Architecture Socket.IO

```typescript
@WebSocketGateway({ cors: { origin: FRONTEND_ORIGIN, credentials: true } })
export class NotificationsGateway {
  @WebSocketServer() server: Server;

  handleConnection(client: Socket) {
    // 1. Extraire JWT (cookie | Authorization header | query param)
    // 2. Vérifier la signature JWT
    // 3. Rejoindre la room privée : "user_${userId}"
  }
}
```

Chaque utilisateur connecté reçoit ses notifications dans une room isolée `user_${userId}`.

### 8.2 Événements déclenchés

| Déclencheur | Destinataire | Contenu |
|-------------|-------------|---------|
| Tâche assignée à quelqu'un d'autre | Assigné | Titre tâche + lead + priorité |
| Lead assigné à un commercial | Commercial | Nom du lead + assigneur |
| Import CSV terminé | Tous | Rapport (X ajoutés, X doublons...) |
| Tâche en retard | Assigné | Titre + jours de retard |
| Rappel tâche (< 24h) | Assigné | Titre + date limite |

### 8.3 Format d'une notification

```json
{
  "id": "uuid",
  "title": "Nouvelle tâche assignée",
  "content": "\"Appel de découverte\" vous a été assignée par Jean Dupont — Lead : Marie Martin (Priorité : Haute)",
  "read": false,
  "createdAt": "2026-06-17T10:30:00.000Z"
}
```

### 8.4 Côté Frontend

- Connexion WebSocket dès l'authentification réussie
- Badge rouge avec compteur sur la cloche
- Dropdown avec liste des notifications non lues
- Marquage "lu" individuel ou global
- Animation à la réception d'une nouvelle notification

---

## 9. Interface Frontend

### 9.1 Routage et protection

```typescript
// Routes protégées par rôle
<Route path="/audit" element={<Protected roles={['ADMIN']}><AuditPage /></Protected>} />
<Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
```

### 9.2 Navigation par rôle (AppLayout.tsx)

| Rôle | Menu disponible |
|------|----------------|
| **ADMIN** | Dashboard · Leads · Pipeline · Tâches · Utilisateurs · Audit |
| **SALES** | Dashboard · Mes leads · Mon pipeline · Tâches |
| **MARKETING** | Dashboard · Leads entrants · Tâches |
| **EXECUTIVE** | Dashboard · Leads · Pipeline · Tâches |

### 9.3 Pages détaillées

#### DashboardPage (`/dashboard`)
1. **KPI Cards (6)** : Total leads · Taux conversion · En cours · Score IA moyen · Tâches · Tâches critiques
2. **Graphique de tendance** : SVG pur, 3 courbes (créés / gagnés / perdus) + sélecteur 7/30/90 jours
3. **Entonnoir de conversion** : Barres horizontales colorées par taux
4. **Leads par source** : Top 8 sources avec barres proportionnelles
5. **Classement commerciaux** : Table avec 🥇🥈🥉 et mini progress bars (ADMIN/EXEC)
6. **Panel alertes** : Leads inactifs >7j + tâches HIGH en retard (ADMIN/EXEC)
7. **Activité récente** : Feed des dernières interactions avec noms résolus (plus d'UUIDs)

#### LeadsPage (`/leads`)
- Tableau paginé avec recherche full-text (nom, email, société)
- **Actions en masse** : checkboxes + barre d'actions (changer stage, archiver, désélectionner)
- Import CSV → **modale de résultats** avec liste des doublons (email / téléphone / nom)
- Panel latéral droit : infos contact · score IA avec barre de progression · tâches suggérées · historique interactions · audit log
- Modal d'assignation pour les tâches suggérées par l'IA (choix du commercial)

#### TasksPage (`/tasks`)
- Vue **Tableau** et vue **Kanban** (drag & drop entre colonnes)
- **8 templates prédéfinis** : clic = auto-remplissage du formulaire
- Filtres : status, type, priorité, retard, recherche textuelle
- Modal de détails : édition + pièces jointes + historique
- **Prévisualisation inline** : images (PNG/JPEG/GIF/WEBP) et PDFs
- Upload / suppression de fichiers (max 10MB)

#### PipelineView (`/pipeline`)
- 6 colonnes Kanban (une par étape de vente)
- Drag & drop → appel API `PATCH /leads/:id` automatique
- Filtres : recherche, score minimum, société, visibilité des colonnes

#### AuditPage (`/audit`) — ADMIN uniquement
- Journal complet avec filtres (type entité, action)
- Badges colorés : CREATE (vert) · UPDATE (bleu) · DELETE (rouge) · ARCHIVE (orange)
- Affichage diff old/new value

### 9.4 Templates de tâches prédéfinis

| Template | Type | Priorité | Délai auto |
|----------|------|----------|-----------|
| 📞 Appel de découverte | CALL | HIGH | J+1, 9h00 |
| ✉️ Email d'introduction | EMAIL | MEDIUM | J+1, 9h00 |
| 📩 Relance | EMAIL | MEDIUM | J+3, 9h00 |
| 🤝 Démonstration | MEETING | HIGH | J+5, 9h00 |
| 📋 Envoyer proposition | TODO | HIGH | J+3, 9h00 |
| 🔁 Suivi post-réunion | EMAIL | MEDIUM | J+1, 9h00 |
| 💬 Appel de négociation | CALL | HIGH | J+2, 9h00 |
| 🏆 Closing | CALL | HIGH | J+1, 9h00 |

Un clic sur un template remplit automatiquement : titre, description, type, priorité et date d'échéance.

---

## 10. Sécurité

### 10.1 Authentification JWT

```
Login → bcrypt.verify(password, hash)
     → jwt.sign({ sub: userId, role }) → Cookie HttpOnly
Requête → JwtAuthGuard → jwt.verify(token) → @CurrentUser()
```

- Algorithme : HS256
- Expiration : 7 jours (configurable via `JWT_EXPIRES_IN`)
- Stockage : Cookie HttpOnly (inaccessible depuis JavaScript)

### 10.2 Contrôle d'accès (RBAC)

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Delete(':id')
remove(@CurrentUser() user: AuthUser, ...) { ... }
```

**Matrice d'accès** :

| Fonctionnalité | ADMIN | EXECUTIVE | MARKETING | SALES |
|----------------|:-----:|:---------:|:---------:|:-----:|
| Tous les leads | ✅ | ✅ | ✅ | ❌ |
| Créer utilisateur | ✅ | ❌ | ❌ | ❌ |
| Archiver lead | ✅ | ❌ | ❌ | ❌ |
| Dashboard alertes | ✅ | ✅ | ❌ | ❌ |
| Journal d'audit | ✅ | ❌ | ❌ | ❌ |
| Assigner tâche | ✅ | ✅ | ❌ | ❌ |
| Import CSV | ✅ | ❌ | ✅ | ❌ |

### 10.3 Sécurité des uploads

- Types MIME vérifiés côté serveur (liste blanche stricte)
- Taille max : 10 MB
- Noms de fichiers sanitisés (UUID + nom original nettoyé)
- Path traversal prevention : vérification que le fichier reste dans `uploads/`

### 10.4 Webhook sécurisé

```typescript
// Comparaison timing-safe (protection contre les attaques temporelles)
if (!crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
  throw new ForbiddenException('Invalid webhook secret');
}
```

### 10.5 RGPD

- Champ `isAnonymized` sur Lead (soft delete)
- `consentDate` et `dataOrigin` enregistrés à la création
- Endpoint d'archivage pour anonymiser sans supprimer physiquement

---

## 11. Fonctionnalités avancées

### 11.1 Import CSV — Détection des doublons

```
Fichier CSV reçu (max 5MB)
    ↓
Parse + normalisation des colonnes (majuscules/accents tolérés)
    ↓
Déduplication intra-fichier (email + téléphone)
    ↓
Vérification DB : email/téléphone existants
    ↓
Vérification DB : firstName+lastName (insensible à la casse)
    ↓
Création en batch de 100 (transaction Prisma)
    ↓
Scoring IA en arrière-plan (300ms entre chaque lead)
    ↓
Notification broadcast
    ↓
Rapport : { addedCount, existingCount, errorCount, duplicates[] }
```

Les doublons incluent la raison : `"email"` | `"phone"` | `"name"`

### 11.2 Rappels automatiques (TasksRemindersRunner)

- Tâche planifiée qui vérifie périodiquement les tâches
- Notification si tâche en retard (et `overdueNotifiedAt` null ou > 24h)
- Rappel si tâche due dans < 24h (et `reminderNotifiedAt` non défini)

### 11.3 Journal d'audit automatique (AuditInterceptor)

```typescript
// Intercepte globalement POST/PATCH/DELETE
// Crée automatiquement un AuditLog pour chaque mutation
{
  action: "UPDATE",
  entityType: "Lead",
  entityId: "uuid",
  oldValue: { stage: "Nouveau", score: null },
  newValue: { stage: "Qualifie", score: 7.2 }
}
```

### 11.4 Graphique SVG de tendance

Implémentation SVG pure, sans bibliothèque externe :
- 3 courbes avec remplissage en gradient
- Grille de fond transparente
- Labels de date (début/fin)
- Totalement responsive (`viewBox` + `preserveAspectRatio`)

### 11.5 Scoring à chaud vs à froid

| Moment | Type | Temps de réponse |
|--------|------|-----------------|
| Démarrage backend | Cold (background) | Non bloquant |
| Création lead | Cold (background) | Non bloquant |
| Import CSV | Cold (background) | Non bloquant |
| Clic utilisateur (cache HIT) | Hot | < 1ms |
| Clic utilisateur (cache MISS) | Hot | 5–45s (Ollama) |

---

## 12. Configuration et déploiement

### 12.1 Variables d'environnement

```env
# Base de données PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/crm"

# Authentication JWT
JWT_SECRET="your-very-secret-key-here"
JWT_EXPIRES_IN="7d"

# Serveur
PORT=3001
NODE_ENV=development

# CORS
FRONTEND_ORIGIN=http://localhost:5173

# Intelligence Artificielle (Ollama)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1

# Webhook sécurisé
WEBHOOK_SECRET=your-webhook-secret
```

### 12.2 Commandes de démarrage

```bash
# 1. Installer les dépendances
cd backend  && npm install
cd frontend && npm install

# 2. Configurer la base de données
cd backend && npx prisma migrate dev

# 3. Démarrer Ollama (IA locale)
ollama serve
ollama pull llama3.1          # ~4.7 GB
# Optionnel : modèle plus rapide
ollama pull llama3.2:1b       # ~1.3 GB, 5-8x plus rapide

# 4. Lancer le développement
cd backend  && npm run dev    # http://localhost:3001
cd frontend && npm run dev    # http://localhost:5173

# 5. Documentation API (développement uniquement)
# http://localhost:3001/api
```

### 12.3 Build de production

```bash
cd backend  && npm run build && npm run prod
cd frontend && npm run build  # → dist/ à servir via Nginx/Apache
```

### 12.4 Structure des uploads

```
backend/uploads/
├── profiles/
│   └── {userId}/
│       └── {uuid}_{originalname}
└── tasks/
    └── {taskId}/
        └── {uuid}_{originalname}
```

---

## 13. Dépendances complètes

### 13.1 Backend

```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/config": "^4.0.3",
    "@nestjs/core": "^10.0.0",
    "@nestjs/jwt": "^11.0.2",
    "@nestjs/passport": "^11.0.5",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/platform-socket.io": "^10.4.22",
    "@nestjs/swagger": "^7.4.2",
    "@nestjs/throttler": "^6.5.0",
    "@nestjs/websockets": "^10.4.22",
    "@prisma/client": "^5.22.0",
    "bcrypt": "^6.0.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.4",
    "csv-parser": "^3.2.0",
    "multer": "^2.1.1",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.1",
    "socket.io-client": "^4.8.3"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "jest": "^29.5.0",
    "prettier": "^3.0.0",
    "prisma": "^5.22.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.1.3"
  }
}
```

### 13.2 Frontend

```json
{
  "dependencies": {
    "@hello-pangea/dnd": "^18.0.1",
    "framer-motion": "^12.38.0",
    "lucide-react": "^1.7.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^7.13.2",
    "socket.io-client": "^4.8.3"
  },
  "devDependencies": {
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "typescript": "~5.9.3",
    "vite": "^8.0.1"
  }
}
```

---

## Annexes

### A. Pipeline de vente

```
Nouveau ──► Contacte ──► Qualifie ──► Proposition ──► Gagne
                                                  └──► Perdu
```

| Étape | Couleur | Description |
|-------|---------|-------------|
| Nouveau | Bleu #3b82f6 | Lead entrant non traité |
| Contacté | Violet #8b5cf6 | Premier contact établi |
| Qualifié | Ambre #f59e0b | Besoin identifié et validé |
| Proposition | Orange #f97316 | Offre/devis envoyé |
| Gagné | Vert #10b981 | Contrat signé |
| Perdu | Rouge #ef4444 | Opportunité perdue |

### B. Types d'interactions

| Type | Description |
|------|-------------|
| EMAIL | Échange par email |
| CALL | Appel téléphonique |
| MEETING | Réunion physique ou visioconférence |
| NOTE | Note interne (pas d'interaction client) |

### C. Flux journée type d'un commercial (SALES)

```
08h00 → Connexion → Dashboard : leads chauds du jour visibles
08h15 → Leads : filtrer stage "Qualifie"
08h30 → Ouvrir lead → Score IA 78/100 + suggestion "Démo produit"
08h35 → Créer tâche depuis suggestion IA (template pré-rempli, J+3)
08h36 → Notification reçue par le commercial assigné
09h00 → Appel client → Ajouter interaction "CALL"
09h30 → Changer stage : "Qualifie" → "Proposition"
10h00 → Notification reçue : "Nouveau lead assigné par Marketing"
11h00 → Import CSV de 50 nouveaux leads
11h00 → Rapport : 42 ajoutés, 6 doublons email, 2 doublons nom
11h05 → Les 42 leads scorés automatiquement par IA en arrière-plan
17h00 → Dashboard : classement → je suis 2ème avec 65% de conversion
```

### D. Points de différenciation

1. **IA locale** : Aucun envoi de données à des serveurs tiers (Ollama tourne en local)
2. **Scoring automatique** : Les leads sont scorés dès leur création, sans action manuelle
3. **Cache intelligent** : La clé de cache intègre la version des données → invalidation naturelle
4. **Audit complet** : Chaque modification est journalisée avec l'état avant/après
5. **Temps réel** : WebSocket pour notifications instantanées sans polling
6. **RGPD-ready** : Archivage soft (isAnonymized), consentement tracé

---

*Documentation technique — CRM Prédictif v2.0 — Juin 2026*
