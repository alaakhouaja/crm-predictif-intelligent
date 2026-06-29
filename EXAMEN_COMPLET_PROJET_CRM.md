# Examen Complet Du Projet CRM Predictif Intelligent

## 1. Objet Du Document

Ce document a pour objectif de fournir une vision complete, detaillee et exploitable du projet afin de pouvoir :

- comprendre rapidement le perimetre reel du systeme
- examiner les fonctionnalites developpees
- identifier les roles de chaque utilisateur
- connaitre les modules frontend, backend et IA
- retrouver les endpoints, les regles metier et les mecanismes de securite
- analyser les travaux deja realises et les ameliorations apportees
- preparer un rapport PFE, une soutenance, un audit technique ou une revue fonctionnelle

Ce fichier est volontairement tres detaille. Il sert de reference globale du projet.

## 2. Resume General Du Projet

Le projet est un CRM predictif intelligent destine a la gestion commerciale. Il centralise la gestion des prospects, l'organisation du pipeline commercial, le suivi des interactions, la planification des taches, les notifications, l'analyse des performances, et l'integration d'un module d'intelligence artificielle pour predire la probabilite de conversion d'un lead.

Le systeme est compose de trois blocs principaux :

1. un frontend web en React pour l'interface utilisateur
2. un backend NestJS pour la logique metier et l'API
3. un module IA en Python pour l'entrainement, l'inference et l'exposition du service de prediction

Le projet ne se limite pas a un simple CRUD. Il implemente un flux metier complet autour du cycle de vie d'un lead, du travail des equipes commerciales, du pilotage managerial et de l'aide a la decision par IA.

## 3. Problematique Couverte Par Le Projet

Le projet repond a plusieurs besoins metier classiques dans une organisation commerciale :

- dispersions des informations commerciales dans plusieurs supports
- difficulte a suivre l'etat reel des prospects
- manque de visibilite sur les actions commerciales en cours
- absence de priorisation intelligente des leads
- gestion des droits insuffisante entre profils metier
- difficulte a mesurer la performance commerciale

La solution proposee consiste a construire un CRM centralise, securise, role-aware, et enrichi par un module predicitf d'IA.

## 4. Objectifs Fonctionnels Du Systeme

Les objectifs principaux du systeme sont les suivants :

- centraliser les leads et les donnees commerciales
- gerer l'authentification et les profils utilisateurs
- appliquer une gestion stricte des roles et permissions
- piloter l'avancement commercial via un pipeline
- suivre les interactions entre utilisateurs et leads
- planifier et executer les taches commerciales
- notifier les utilisateurs en cas d'evenement important
- fournir des tableaux de bord d'aide a la decision
- preparer des donnees IA pour l'apprentissage automatique
- afficher une prediction IA dans la fiche detaillee d'un lead

## 5. Structure Generale Du Depot

Le depot est organise comme suit :

```text
CRM/
|- backend/
|  |- prisma/
|  |- src/
|  |  |- auth/
|  |  |- common/
|  |  |- dashboard/
|  |  |- interactions/
|  |  |- ia/
|  |  |- leads/
|  |  |- notifications/
|  |  |- prisma/
|  |  |- tasks/
|  |  |- users/
|- frontend/
|  |- src/
|  |  |- api/
|  |  |- auth/
|  |  |- components/
|  |  |- pages/
|  |  |- utils/
|- ia/
|  |- datasets/
|  |- models/
|  |- reports/
|  |- api.py
|  |- export_leads.py
|  |- predict_lead.py
|  |- train_model.py
|- PROJECT_TECHNICAL_OVERVIEW.md
|- EXAMEN_COMPLET_PROJET_CRM.md
```

### 5.1 Dossier `backend/`

Ce dossier contient :

- l'API NestJS
- la logique metier
- les regles d'autorisation
- l'acces PostgreSQL via Prisma
- la gestion des fichiers uploades
- les notifications temps reel
- les aggregations dashboard
- l'integration backend vers le microservice IA

### 5.2 Dossier `frontend/`

Ce dossier contient :

- la page de connexion
- le layout principal de l'application
- le dashboard
- la liste des leads
- la vue pipeline Kanban
- la gestion des taches
- la gestion des utilisateurs
- la page profil
- la page parametres
- les types TypeScript partages
- les appels API et le contexte d'authentification

### 5.3 Dossier `ia/`

Ce dossier contient :

- l'export des donnees d'entrainement
- le dataset CSV
- le script d'entrainement du modele CatBoost
- le script de prediction locale
- l'API FastAPI pour exposer la prediction
- les artefacts du modele
- les rapports de metriques et d'importance des variables

## 6. Technologies Utilisees

## 6.1 Frontend

- React
- TypeScript
- Vite
- React Router
- Context API pour la session
- `@hello-pangea/dnd` pour le drag and drop du pipeline
- `framer-motion` pour les animations
- `lucide-react` pour les icones
- `socket.io-client` pour les notifications temps reel

## 6.2 Backend

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT
- Passport
- `class-validator`
- `class-transformer`
- Multer
- Socket.IO
- Swagger

## 6.3 Intelligence Artificielle

- Python 3
- pandas
- scikit-learn
- CatBoost
- FastAPI
- Uvicorn

## 6.4 Outils Et Execution

- npm
- PowerShell / terminal local Windows
- Docker Compose possible pour la base de donnees
- HTTP pour les communications inter-services
- WebSocket pour les notifications

## 7. Architecture Globale

L'architecture du projet suit une separation claire des responsabilites.

### 7.1 Architecture Logique

1. Le frontend React envoie des requetes HTTP au backend NestJS.
2. Le backend NestJS centralise la logique metier et l'acces aux donnees.
3. Prisma dialogue avec PostgreSQL.
4. Le backend peut appeler le microservice IA FastAPI pour demander une prediction.
5. Le frontend recupere la prediction via le backend, jamais directement via FastAPI.
6. Les notifications temps reel passent via Socket.IO.

### 7.2 Architecture Applicative

- React : presentation, navigation, formulaires, experience utilisateur
- NestJS : securite, API REST, logique metier, audits, notifications, filtrage role-aware
- Prisma : mapping objet-relationnel et requetes SQL
- PostgreSQL : persistance des entites metier
- FastAPI : service de prediction IA
- CatBoost : modele de classification binaire

### 7.3 Ports Utilises

- frontend Vite : port typique `5173`
- backend NestJS : port typique `3001`
- FastAPI IA : port `8000`

## 8. Acteurs Du Systeme

Le systeme repose sur des acteurs humains et techniques.

### 8.1 Administrateur

L'administrateur est le profil le plus privilegie. Il supervise l'ensemble du systeme.

Responsabilites principales :

- creer et gerer les utilisateurs
- voir tous les leads
- creer, modifier, archiver, desarchiver et supprimer les leads
- reassigner les leads
- modifier les champs sensibles comme le score ou la probabilite
- gerer les taches globalement
- consulter tous les tableaux de bord
- exporter les donnees pour l'IA
- administrer la plateforme

### 8.2 Commercial

Le commercial est le profil operationnel charge du suivi quotidien des prospects.

Responsabilites principales :

- consulter ses propres leads
- mettre a jour les leads dont il est proprietaire
- deplacer ses leads dans le pipeline
- ajouter des interactions
- gerer les taches qui lui sont liees
- consulter la prediction IA sur ses leads
- suivre les indicateurs qui concernent son activite

### 8.3 Marketing

Le profil marketing s'occupe surtout de l'alimentation du CRM et de l'acquisition.

Responsabilites principales :

- creer des leads
- importer des leads depuis un fichier CSV
- consulter les leads selon les regles du role
- creer des taches en lien avec les leads
- participer au flux d'entree des prospects

### 8.4 Executive

Le profil executive represente la direction ou le pilotage.

Responsabilites principales :

- consulter les dashboards globaux
- voir le pipeline en lecture seule
- suivre les performances
- exporter les donnees IA
- creer et assigner certaines taches pour les commerciaux

### 8.5 Systeme Externe

Cet acteur represente une source externe qui envoie des leads via webhook.

Responsabilites principales :

- transmettre des prospects au CRM
- alimenter automatiquement le systeme

### 8.6 Service IA

Il s'agit d'un acteur technique interne.

Responsabilites principales :

- recevoir les features d'un lead
- calculer la probabilite de conversion
- retourner un score interpretable
- retourner un label qualitatif

## 9. Matrice Des Roles Et Permissions

La logique des droits est geree a plusieurs niveaux :

- au niveau des routes frontend
- au niveau des controllers backend
- au niveau des services backend
- au niveau des filtres de donnees

### 9.1 Vue Synthese

| Fonctionnalite                   | ADMIN | SALES                   | MARKETING | EXECUTIVE                 |
| -------------------------------- | ----- | ----------------------- | --------- | ------------------------- |
| Connexion                        | Oui   | Oui                     | Oui       | Oui                       |
| Dashboard                        | Oui   | Oui                     | Oui       | Oui                       |
| Leads                            | Oui   | Oui                     | Oui       | Oui                       |
| Pipeline                         | Oui   | Oui                     | Non       | Oui, lecture seule        |
| Taches                           | Oui   | Oui                     | Oui       | Oui                       |
| Gestion utilisateurs             | Oui   | Non                     | Non       | Liste partielle seulement |
| Import CSV                       | Oui   | Non                     | Oui       | Non                       |
| Export IA                        | Oui   | Oui, limite a ses leads | Non       | Oui                       |
| Suppression de lead              | Oui   | Non                     | Non       | Non                       |
| Archivage / desarchivage         | Oui   | Non                     | Non       | Non                       |
| Reassignation de taches          | Oui   | Non                     | Non       | Oui                       |
| Modification score / probabilite | Oui   | Non                     | Non       | Non                       |

### 9.2 Regles Metier Importantes

- un commercial voit principalement ses leads
- un executive voit globalement mais ne modifie pas le pipeline comme un administrateur ou un commercial
- le marketing peut importer des leads mais n'a pas tous les droits de pilotage
- la suppression physique d'un lead est reservee a l'administrateur
- certaines modifications sensibles dans `LeadsService` sont reservees a l'administrateur
- l'assignation d'une tache a un autre utilisateur est reservee a certains roles
- les taches peuvent etre assignees a des utilisateurs de role `SALES`

## 10. Entites Metier Principales

Le schema Prisma contient plusieurs entites centrales.

### 10.1 Enums

- `UserRole` : `ADMIN`, `SALES`, `MARKETING`, `EXECUTIVE`
- `LeadStage` : `Nouveau`, `Contacte`, `Qualifie`, `Proposition`, `Gagne`, `Perdu`
- `InteractionType` : `EMAIL`, `CALL`, `MEETING`, `NOTE`
- `TaskType` : `CALL`, `EMAIL`, `MEETING`, `TODO`
- `TaskStatus` : `OPEN`, `IN_PROGRESS`, `DONE`, `CANCELED`
- `TaskPriority` : `LOW`, `MEDIUM`, `HIGH`

### 10.2 Utilisateur

Un utilisateur possede notamment :

- un identifiant
- un email unique
- un hash de mot de passe
- un role
- un prenom
- un nom
- un telephone
- une date de creation
- une date de mise a jour
- un chemin de photo de profil

### 10.3 Lead

Un lead contient notamment :

- nom
- prenom
- email
- telephone
- entreprise
- source
- stage
- score
- probabilite de conversion
- notes
- proprietaire
- etat d'anonymisation
- dates de creation et de mise a jour

### 10.4 Interaction

Une interaction relie :

- un type d'interaction
- un contenu
- un utilisateur createur
- un lead
- une date de creation

### 10.5 Tache

Une tache contient :

- un titre
- une description
- un type
- un statut
- une priorite
- un niveau de progression
- une date d'echeance
- un lead optionnel
- un assigne optionnel
- un createur
- des indicateurs de notification de retard ou rappel

### 10.6 Piece Jointe De Tache

Une piece jointe permet :

- d'associer un fichier a une tache
- de memoriser le nom d'origine
- de stocker le type MIME
- de suivre la taille
- de connaitre l'utilisateur ayant uploade le fichier

### 10.7 Audit Log

Le journal d'audit permet de tracer :

- l'utilisateur responsable
- l'action effectuee
- l'entite cible
- l'identifiant de l'entite
- l'ancienne valeur
- la nouvelle valeur
- la date de l'action

### 10.8 Notification

Une notification contient :

- l'utilisateur destinataire
- un titre
- un contenu
- un statut de lecture
- une date de creation

## 11. Backend NestJS

Le backend est le coeur du projet. Il contient l'API, la securite, les regles metier, les filtres de donnees, les integrations et le suivi des changements.

## 11.1 Initialisation Globale

Le fichier `backend/src/main.ts` met en place :

- un `ValidationPipe` global avec whitelist et transformation
- un filtre global d'exceptions
- un interceptor d'audit
- un middleware de `requestId`
- CORS avec credentials
- Swagger hors production

### 11.1.1 Ce Que Cela Apporte

- validation stricte des DTO
- meilleure tracabilite
- messages d'erreur uniformes
- compatibilite avec le frontend React
- documentation API exploitable

## 11.2 Module Auth

Le module `auth` gere l'authentification, la session, le profil utilisateur, la photo de profil et le changement de mot de passe.

### 11.2.1 Endpoints Auth

- `POST /auth/bootstrap`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/register`
- `GET /auth/me`
- `PATCH /auth/me`
- `POST /auth/me/photo`
- `GET /auth/me/photo`
- `POST /auth/change-password`

### 11.2.2 Ce Que Fait Chaque Endpoint

#### `POST /auth/bootstrap`

- cree le premier administrateur
- ne doit fonctionner que si aucun utilisateur n'existe
- retourne le token
- pose aussi le cookie `access_token`

#### `POST /auth/login`

- verifie les identifiants
- compare le mot de passe avec bcrypt
- genere un JWT
- le stocke dans un cookie HTTP-only
- retourne la reponse d'authentification

#### `POST /auth/logout`

- supprime le cookie d'authentification

#### `POST /auth/register`

- cree un nouvel utilisateur
- reserve a `ADMIN`

#### `GET /auth/me`

- retourne les informations du compte connecte

#### `PATCH /auth/me`

- met a jour le prenom, le nom et le telephone du compte courant

#### `POST /auth/me/photo`

- charge une photo de profil
- valide le type MIME
- impose une taille limite
- enregistre le fichier dans `uploads/profiles/<userId>/`
- met a jour le chemin de la photo en base

#### `GET /auth/me/photo`

- retourne l'image protegee de l'utilisateur
- verifie que le chemin resolu reste dans le dossier `uploads`

#### `POST /auth/change-password`

- verifie l'ancien mot de passe
- enregistre le nouveau hash

### 11.2.3 Logique Metier Du Service Auth

Le `AuthService` couvre notamment :

- normalisation de l'email
- hash du mot de passe
- comparaison bcrypt
- generation du token
- chargement du profil public
- mise a jour du profil
- gestion de la photo
- suppression de l'ancienne photo si necessaire
- changement de mot de passe

### 11.2.4 Securite Auth

- JWT stocke dans un cookie HTTP-only
- `sameSite: 'lax'`
- `secure` en production
- `JwtAuthGuard`
- `RolesGuard`
- controle des acces par decorateur `@Roles`

## 11.3 Module Users

Le module `users` sert a l'administration des comptes.

### 11.3.1 Endpoints Users

- `POST /users`
- `GET /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `DELETE /users/:id`

### 11.3.2 Fonctions Cles

- creation de compte
- consultation paginee des utilisateurs
- lecture detaillee
- modification
- suppression
- verification d'unicite des emails
- hash du mot de passe cote service

### 11.3.3 Regles D'Acces

- controleur principal reserve a `ADMIN`
- `GET /users` est aussi utile a `EXECUTIVE` pour l'assignation de taches

## 11.4 Module Leads

Le module `leads` est le coeur fonctionnel du CRM.

### 11.4.1 Endpoints Leads

- `POST /leads`
- `POST /leads/import`
- `POST /leads/webhook`
- `POST /leads/:id/archive`
- `POST /leads/:id/unarchive`
- `GET /leads/export-ai`
- `GET /leads`
- `GET /leads/:id`
- `GET /leads/:id/activity`
- `GET /leads/:id/prediction`
- `PATCH /leads/:id`
- `DELETE /leads/:id`

### 11.4.2 Ce Que Le Module Leads Realise

- creation d'un prospect
- listing pagine et filtre
- recherche
- affichage detaille
- mise a jour
- suppression
- archivage et desarchivage
- import CSV de leads
- reception via webhook
- export des donnees pour l'IA
- historique d'activite
- prediction IA a la demande
- ecriture dans l'audit log
- notifications lors d'assignations et de certains evenements

### 11.4.3 Regles Metier Importantes Sur Les Leads

- les commerciaux travaillent surtout sur leurs leads
- certaines operations sont reservees a `ADMIN`
- l'import CSV est ouvert a `ADMIN` et `MARKETING`
- l'export IA est limite par role
- les champs sensibles ne sont pas libres pour tous

### 11.4.4 Elements Importants De `LeadsService`

Le service gere un volume important de logique metier :

- filtrage selon le role
- pagination
- controle des droits d'acces
- snapshot avant modification
- creation d'entrees d'audit
- agrégation d'activites
- calcul des features IA
- export des donnees d'entrainement
- appel du service IA

### 11.4.5 Webhook De Leads

Le webhook permet a une source externe d'envoyer un lead.

Des protections ont ete renforcees :

- verification du secret
- comparaison securisee via `crypto.timingSafeEqual`
- rejet si les longueurs diffèrent

### 11.4.6 Prediction IA D'un Lead

L'endpoint `GET /leads/:id/prediction` :

1. charge le lead et ses donnees liees
2. calcule les features metier
3. appelle le `IaService`
4. retourne `probability`, `score`, `label`

## 11.5 Module Interactions

Le module `interactions` permet de tracer les actions commerciales effectuees autour d'un lead.

### 11.5.1 Endpoints Interactions

- `POST /interactions`
- `GET /interactions`
- `GET /interactions/:id`
- `PATCH /interactions/:id`
- `DELETE /interactions/:id`

### 11.5.2 Fonctionnalites

- creation d'une interaction
- listing pagine et filtre
- lecture d'une interaction
- modification
- suppression

### 11.5.3 Regles D'Acces

- `ADMIN`, `EXECUTIVE`, `MARKETING` ont une lecture elargie
- la creation est ouverte a `ADMIN` et `SALES`
- un commercial ne peut pas agir sur n'importe quel lead hors de son perimetre
- seul le createur ou un admin peut modifier ou supprimer une interaction

## 11.6 Module Tasks

Le module `tasks` structure les actions commerciales a realiser.

### 11.6.1 Endpoints Tasks

- `POST /tasks`
- `GET /tasks`
- `GET /tasks/stats`
- `GET /tasks/:id`
- `PATCH /tasks/:id`
- `DELETE /tasks/:id`
- `GET /tasks/:id/activity`
- `GET /tasks/:id/attachments`
- `POST /tasks/:id/attachments`
- `GET /tasks/attachments/:attachmentId/download`
- `DELETE /tasks/attachments/:attachmentId`

### 11.6.2 Fonctionnalites

- creation de taches
- listing avec filtres
- statistiques
- lecture detaillee
- mise a jour
- suppression
- historique d'activite
- upload de pieces jointes
- telechargement de pieces jointes
- suppression de pieces jointes
- rappels automatiques

### 11.6.3 Regles D'Acces

- creation ouverte a plusieurs roles metier
- assignation a autrui reservee a `ADMIN` et `EXECUTIVE`
- filtrage par proprietaire, createur ou assigne selon le role
- certaines taches ne sont modifiables qu'en fonction du perimetre de l'utilisateur

### 11.6.4 Rappels Automatiques

Le runner de rappels traite :

- les taches en retard
- les notifications d'echeance
- le suivi de `overdueNotifiedAt`
- le suivi de `reminderNotifiedAt`

## 11.7 Module Dashboard

Le module `dashboard` est dedie a l'analyse metier.

### 11.7.1 Endpoints Dashboard

- `GET /dashboard/overview`
- `GET /dashboard/pipeline`
- `GET /dashboard/by-source`
- `GET /dashboard/by-owner`
- `GET /dashboard/trends`
- `GET /dashboard/activity`
- `GET /dashboard/stage-conversion`

### 11.7.2 Ce Que Le Dashboard Calcule

- total de leads
- taux de conversion
- nombre de leads qualifies
- score IA moyen
- repartition du pipeline
- origine des leads
- performance par proprietaire
- activite recente
- tendances temporelles
- conversion par etape

### 11.7.3 Ameliorations Realisees

Des optimisations ont ete appliquees :

- remplacement d'un regroupement JavaScript en memoire par `Prisma.groupBy()`
- verification que les tendances sont retournees dans le bon ordre chronologique pour le frontend

## 11.8 Module Notifications

Le module `notifications` gere l'information utilisateur en temps reel et en lecture differée.

### 11.8.1 Endpoints Notifications

- `GET /notifications`
- `PATCH /notifications/:id/read`

### 11.8.2 Fonctionnalites

- lister les notifications personnelles
- marquer une notification comme lue
- emettre les notifications vers le frontend en temps reel via Socket.IO
- envoyer des notifications unitaires ou broadcast

### 11.8.3 Robustesse Ajoutee

La creation de notifications broadcast a ete securisee via `prisma.$transaction()` afin d'eviter les ecritures partielles.

## 11.9 Module IA Cote Backend

Le fichier `backend/src/ia/ia.service.ts` fait le pont entre NestJS et FastAPI.

### 11.9.1 Responsabilites

- construire la requete HTTP vers FastAPI
- appeler `POST /predict`
- transmettre les features du lead
- lire et valider la reponse
- appliquer un timeout
- utiliser un cache memoire sur une duree definie
- transmettre un header `X-IA-API-Key` si configure

## 12. Frontend React

Le frontend offre toutes les interfaces utilisateur du CRM.

## 12.1 Routage Principal

Les routes principales sont :

- `/login`
- `/dashboard`
- `/leads`
- `/pipeline`
- `/users`
- `/profile`
- `/settings`
- `/tasks`
- `/`

### 12.1.1 Protection Des Routes

- toutes les pages metier sont protegee par un composant `Protected`
- `/pipeline` est reserve a `ADMIN`, `SALES`, `EXECUTIVE`
- `/users` est reserve a `ADMIN`
- `/` redirige vers `dashboard` si connecte sinon vers `login`

## 12.2 Contexte D'Authentification

Le `AuthContext` centralise :

- `user`
- `loading`
- `photoSrc`
- `login()`
- `logout()`
- `refreshMe()`

### 12.2.1 Fonctionnement

- au demarrage, le frontend appelle `/auth/me`
- si l'utilisateur est connecte, le contexte charge le profil
- la photo est chargee ensuite
- apres `login()`, le frontend appelle `refreshMe()`
- apres `logout()`, la session locale est nettoyee

## 12.3 AppLayout

Le layout principal contient :

- la sidebar
- la barre de recherche
- la cloche de notifications
- l'avatar utilisateur
- le menu profil / parametres / deconnexion

### 12.3.1 Navigation Selon Le Role

- `ADMIN` : dashboard, leads, pipeline, taches, utilisateurs
- `SALES` : dashboard, mes leads, mon pipeline, taches
- `MARKETING` : dashboard, leads entrants, taches
- `EXECUTIVE` : dashboard, leads, pipeline, taches

## 12.4 LoginPage

La page de connexion :

- collecte email et mot de passe
- appelle `login()`
- redirige apres succes

## 12.5 DashboardPage

La page dashboard :

- charge plusieurs blocs de donnees en parallele
- affiche des KPI
- montre la repartition du pipeline
- montre les leads par source
- affiche la performance par commercial
- montre l'activite recente

## 12.6 LeadsPage

`LeadsPage` est l'interface frontend la plus riche du projet.

### 12.6.1 Fonctionnalites Principales

- liste paginee des leads
- recherche
- filtrage archive / non archive
- creation de lead
- edition d'un lead
- detail d'un lead
- affichage du proprietaire
- import CSV
- export IA
- journal d'activite
- historique des modifications
- creation d'interactions
- gestion de taches liees
- prediction IA dans la fiche detaillee
- archivage / desarchivage
- suppression

### 12.6.2 Capacites Selon Le Role Cote UI

- creer un lead : `ADMIN`, `SALES`, `MARKETING`
- importer CSV : `ADMIN`, `MARKETING`
- exporter pour IA : `ADMIN`, `EXECUTIVE`
- archiver et supprimer : `ADMIN`
- interaction : `ADMIN` ou `SALES` proprietaire selon le cas
- tache sur lead : selon role et perimetre

### 12.6.3 Bloc Prediction IA

La fiche detaillee du lead affiche :

- un score sur 100
- une probabilite en pourcentage
- un label qualitatif
- une presentation visuelle par badge

## 12.7 PipelineView

Le pipeline propose une vue Kanban des leads.

### 12.7.1 Fonctionnalites

- regroupement par stage
- drag and drop
- recherche
- filtres par score, entreprise et etapes
- panneau detail d'un lead
- score moyen par colonne

### 12.7.2 Regles D'Edition

- `ADMIN` et `SALES` peuvent deplacer les cartes
- `EXECUTIVE` voit le pipeline en lecture seule

## 12.8 TasksPage

La page des taches fournit :

- une vue liste
- une vue Kanban
- des statistiques
- des filtres multiples
- l'edition d'une tache
- la consultation des pieces jointes
- l'acces a l'historique d'activite

## 12.9 ProfilePage

La page profil a ete repensee.

### 12.9.1 Etat Final Souhaite Et Implante

- les informations personnelles sont en lecture seule
- l'edition textuelle ne se fait plus ici
- la photo de profil peut etre modifiee depuis cette page
- un bouton renvoie vers les parametres pour modifier les informations

### 12.9.2 Contenu Affiche

- avatar
- identite
- email
- role
- telephone
- date de creation
- date de mise a jour

## 12.10 SettingsPage

La page parametres centralise les modifications du compte courant.

### 12.10.1 Fonctionnalites

- modification du prenom
- modification du nom
- modification du telephone
- changement du mot de passe
- actualisation du profil
- deconnexion

### 12.10.2 Synchronisation

Un `useEffect` synchronise l'etat local du formulaire avec les donnees rafraichies de l'utilisateur.

## 12.11 UsersPage

La page utilisateurs permet a l'administrateur de :

- lister les comptes
- creer un utilisateur
- modifier un utilisateur
- supprimer un utilisateur

## 13. Module IA En Python

Le dossier `ia/` couvre l'ensemble de la chaine de valeur IA.

## 13.1 Objectif Du Module IA

Predire la probabilite qu'un lead se convertisse en client ou en succes commercial.

## 13.2 Fichiers Principaux

- `export_leads.py`
- `train_model.py`
- `predict_lead.py`
- `api.py`
- `datasets/leads_dataset.csv`
- `models/lead_conversion_catboost.cbm`
- `reports/training_metrics.json`
- `reports/feature_importance.csv`

## 13.3 Export Des Donnees

Le projet exporte des donnees de leads afin de generer un dataset d'apprentissage.

L'export repose sur des champs metier tels que :

- nombre d'interactions
- nombre de taches ouvertes
- delais d'activite
- score CRM
- source
- proprietes du lead

## 13.4 Entrainement Du Modele

Le script `train_model.py` :

- charge le dataset
- prepare les colonnes
- gere le desequilibre des classes avec `class_weights`
- entraine un `CatBoostClassifier`
- calcule plusieurs metriques
- optimise le seuil de decision
- sauvegarde le modele
- sauvegarde un rapport JSON
- exporte l'importance des variables

### 13.4.1 Metriques Calculees

- accuracy
- precision
- recall
- f1-score
- roc-auc
- confusion matrix

### 13.4.2 Amelioration Methodologique Importante

Une fuite d'information potentielle liee a `stage` a ete retiree de l'entrainement afin d'obtenir des performances plus realistes.

### 13.4.3 Optimisation Du Seuil

Le seuil de classification n'est pas force a `0.5`. Il est optimise a partir des metriques pour obtenir un compromis plus pertinent entre precision et rappel.

## 13.5 Prediction Locale

Le script `predict_lead.py` :

- charge le modele `.cbm`
- charge les metriques sauvegardees
- lit le seuil optimise
- recoit des features
- retourne :
  - `probability`
  - `score`
  - `label`
  - `threshold`

## 13.6 API FastAPI

Le fichier `api.py` expose :

- `GET /health`
- `POST /predict`

### 13.6.1 Responsabilites

- chargement du modele au demarrage
- validation du schema d'entree
- appel du moteur de prediction
- activation de CORS
- verification optionnelle d'une cle API

## 13.7 Integration De L'IA Dans Le CRM

Le flux complet est le suivant :

1. le frontend ouvre la fiche d'un lead
2. `LeadsPage` appelle `GET /leads/:id/prediction`
3. le backend charge les donnees du lead
4. le backend calcule les features metier
5. `IaService` appelle FastAPI
6. FastAPI appelle `predict_lead.py`
7. la prediction retourne au backend
8. le backend retourne la prediction au frontend
9. le frontend affiche le score, la probabilite et le label

## 14. Endpoints Backend Recapitulatifs

### 14.1 Auth

- `POST /auth/bootstrap`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/register`
- `GET /auth/me`
- `PATCH /auth/me`
- `POST /auth/me/photo`
- `GET /auth/me/photo`
- `POST /auth/change-password`

### 14.2 Users

- `POST /users`
- `GET /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `DELETE /users/:id`

### 14.3 Leads

- `POST /leads`
- `POST /leads/import`
- `POST /leads/webhook`
- `POST /leads/:id/archive`
- `POST /leads/:id/unarchive`
- `GET /leads/export-ai`
- `GET /leads`
- `GET /leads/:id`
- `GET /leads/:id/activity`
- `GET /leads/:id/prediction`
- `PATCH /leads/:id`
- `DELETE /leads/:id`

### 14.4 Interactions

- `POST /interactions`
- `GET /interactions`
- `GET /interactions/:id`
- `PATCH /interactions/:id`
- `DELETE /interactions/:id`

### 14.5 Tasks

- `POST /tasks`
- `GET /tasks`
- `GET /tasks/stats`
- `GET /tasks/:id`
- `PATCH /tasks/:id`
- `DELETE /tasks/:id`
- `GET /tasks/:id/activity`
- `GET /tasks/:id/attachments`
- `POST /tasks/:id/attachments`
- `GET /tasks/attachments/:attachmentId/download`
- `DELETE /tasks/attachments/:attachmentId`

### 14.6 Dashboard

- `GET /dashboard/overview`
- `GET /dashboard/pipeline`
- `GET /dashboard/by-source`
- `GET /dashboard/by-owner`
- `GET /dashboard/trends`
- `GET /dashboard/activity`
- `GET /dashboard/stage-conversion`

### 14.7 Notifications

- `GET /notifications`
- `PATCH /notifications/:id/read`

### 14.8 App

- `GET /health`

## 15. Mecanismes De Securite

Le projet contient plusieurs couches de securite.

## 15.1 Authentification

- JWT
- cookie HTTP-only
- guard NestJS
- endpoint `/auth/me` pour reconstruire la session frontend

## 15.2 Autorisation

- decorateur `@Roles`
- `RolesGuard`
- filtrage des donnees en service
- restrictions UI cote frontend

## 15.3 Validation Des Donnees

- DTO NestJS
- `ValidationPipe`
- `whitelist`
- `forbidNonWhitelisted`
- `transform`

## 15.4 Securite Du Webhook

Le webhook lead compare maintenant le secret de maniere securisee avec `crypto.timingSafeEqual`.

## 15.5 Upload De Fichiers

- types d'image limites
- taille limitee
- stockage dans un dossier dedie
- verification du chemin avant envoi du fichier

## 15.6 Isolation Des Donnees

- un commercial ne voit pas librement toutes les donnees
- certaines routes sont filtrees par proprietaire de lead
- certaines taches sont visibles selon createur, assigne ou contexte role

## 15.7 Journalisation Et Audit

- audit interceptor global
- audit log sur les entites metier
- snapshots avant/apres certaines modifications

## 15.8 Robustesse Transactionnelle

La creation de notifications broadcast est encapsulee dans une transaction Prisma pour eviter les enregistrements partiels.

## 16. Travaux Realises Pendant Le Developpement

Cette section recense les travaux et correctifs majeurs deja effectues.

### 16.1 Correctifs Securite Et Robustesse

- remplacement de la comparaison directe du secret webhook par `crypto.timingSafeEqual`
- transaction Prisma pour la creation broadcast des notifications
- verification de l'ordre chronologique des donnees de tendances
- optimisation du calcul par proprietaire dans le dashboard via `groupBy()`

### 16.2 Integration IA Complete

- creation de `ia/train_model.py`
- gestion automatique du desequilibre avec `class_weights`
- calcul des metriques d'apprentissage
- optimisation du seuil
- creation de `ia/predict_lead.py`
- creation de `ia/api.py`
- creation de `backend/src/ia/ia.service.ts`
- ajout de `GET /leads/:id/prediction`
- affichage de la prediction dans `LeadsPage`

### 16.3 Partie Profil Et Parametres

- ajout de l'upload de photo de profil
- ajout des endpoints backend associes
- resolution du probleme d'affichage de photo
- chargement de la photo cote frontend via fetch authentifie puis conversion en data URL
- avatar unifie dans le header et le profil
- passage des informations personnelles en lecture seule sur `ProfilePage`
- transfert de la modification textuelle vers `SettingsPage`
- ajout du champ telephone dans les parametres

### 16.4 Partie Comptes Et Administration

- mise a jour du seed admin
- ajustement des DTO d'exemple Swagger
- synchronisation du compte admin reel en base

### 16.5 Partie Documentation Et Rapport

- creation d'un overview technique du projet
- preparation des materiaux UML et des descriptions de cas d'utilisation
- structuration des informations pour le rapport PFE

## 17. Interfaces Utilisateur Developpees

Les interfaces actuellement developpees couvrent :

- page de connexion
- dashboard
- page des leads
- panneau detail d'un lead
- vue pipeline
- page des taches
- gestion des utilisateurs
- profil
- parametres
- header avec notifications et avatar

## 18. Flux Utilisateur Principaux

## 18.1 Flux De Connexion

1. l'utilisateur saisit email et mot de passe
2. le frontend appelle `POST /auth/login`
3. le backend verifie les identifiants
4. le backend pose le cookie JWT
5. le frontend appelle `GET /auth/me`
6. le contexte utilisateur est hydrate
7. l'utilisateur accede a l'application

## 18.2 Flux D'Examen D'Un Lead

1. ouvrir la page leads
2. charger la liste paginee
3. ouvrir la fiche detail
4. voir les informations metier
5. voir les interactions, taches et audit log
6. voir la prediction IA
7. effectuer une mise a jour si les droits le permettent

## 18.3 Flux D'Import CSV

1. l'utilisateur autorise selectionne un fichier CSV
2. le frontend l'envoie au backend
3. le backend parse les lignes
4. le backend cree les leads
5. le backend genere les notifications necessaires

## 18.4 Flux D'Upload De Photo

1. l'utilisateur choisit une image
2. le frontend appelle `POST /auth/me/photo`
3. le backend valide et stocke le fichier
4. `refreshMe()` recharge le profil
5. le frontend recharge la photo protegee
6. l'avatar est mis a jour

## 19. Fichiers Les Plus Importants A Examiner

### 19.1 Backend

- `backend/src/main.ts`
- `backend/src/app.module.ts`
- `backend/prisma/schema.prisma`
- `backend/prisma/seed.ts`
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/leads/leads.controller.ts`
- `backend/src/leads/leads.service.ts`
- `backend/src/tasks/tasks.controller.ts`
- `backend/src/tasks/tasks.service.ts`
- `backend/src/dashboard/dashboard.service.ts`
- `backend/src/notifications/notifications.service.ts`
- `backend/src/notifications/notifications.gateway.ts`
- `backend/src/interactions/interactions.service.ts`
- `backend/src/ia/ia.service.ts`

### 19.2 Frontend

- `frontend/src/App.tsx`
- `frontend/src/auth/AuthContext.tsx`
- `frontend/src/components/AppLayout.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/pages/LeadsPage.tsx`
- `frontend/src/pages/PipelineView.tsx`
- `frontend/src/pages/TasksPage.tsx`
- `frontend/src/pages/ProfilePage.tsx`
- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/pages/UsersPage.tsx`
- `frontend/src/types.ts`
- `frontend/src/utils/profilePhoto.ts`

### 19.3 IA

- `ia/export_leads.py`
- `ia/train_model.py`
- `ia/predict_lead.py`
- `ia/api.py`
- `ia/reports/training_metrics.json`
- `ia/reports/feature_importance.csv`

## 20. Points Forts Du Projet

- architecture separee et claire
- couverture fonctionnelle riche pour un CRM PFE
- controle d'acces par role bien present
- gestion de leads, pipeline, taches, interactions et notifications
- journal d'audit
- integration IA de bout en bout
- dashboard analytique
- separation frontend / backend / IA saine
- profil utilisateur complet avec photo

## 21. Limites Ou Points D'Amelioration Possibles

- factoriser davantage certaines logiques de calcul de features IA
- renforcer encore les tests automatiques
- industrialiser davantage le deploiement
- enrichir les dashboards avec plus de visualisations
- ajouter une explicabilite IA avancee si necessaire
- renforcer la documentation d'installation et d'exploitation

## 22. Conclusion D'Examen

Le projet CRM predictif intelligent est deja un systeme riche et coherent. Il couvre les besoins essentiels d'un CRM moderne :

- authentification
- gestion des roles
- gestion des leads
- pipeline commercial
- taches
- interactions
- notifications
- tableaux de bord
- audit
- IA predictive

D'un point de vue PFE, ce projet presente un bon niveau de maturite fonctionnelle et technique. Il combine :

- une architecture full-stack moderne
- des contraintes de securite reelles
- des regles metier selon les roles
- une couche analytique
- une integration d'intelligence artificielle exploitable dans l'interface

Ce document peut servir directement comme base :

- de chapitre d'analyse technique
- de support de revision avant soutenance
- de base pour rediger des UML
- de dossier d'examen complet du projet

