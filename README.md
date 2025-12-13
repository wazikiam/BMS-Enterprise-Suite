\# BMS Enterprise Suite



A professional Business Management System inspired by Odoo, built with modern technologies for enterprise use.



\## 📋 Project Overview



BMS Enterprise Suite is a comprehensive business management system designed for small to medium enterprises. It provides integrated modules for inventory, sales, customer management, HR, and more, with a focus on professionalism, performance, and usability.



\## 🚀 Technology Stack



\### Frontend

\- \*\*React 18\*\* with TypeScript (strict mode)

\- \*\*Material-UI\*\* (MUI) for components

\- \*\*Vite\*\* for build tooling

\- \*\*React Router\*\* for navigation

\- \*\*Zustand\*\* for state management

\- \*\*React Query\*\* for data fetching

\- \*\*Axios\*\* for HTTP client



\### Backend

\- \*\*Node.js\*\* with Express

\- \*\*TypeScript\*\* for type safety

\- \*\*JWT\*\* for authentication

\- \*\*bcryptjs\*\* for password hashing



\### Architecture

\- \*\*Monorepo\*\* structure with workspaces

\- \*\*Packages\*\*: Core, Shared, Server

\- \*\*Apps\*\*: Admin Web (React), Desktop (Electron - coming soon)



\## 📁 Project Structure

BMS-Enterprise-Suite/

├── packages/

│ ├── core/ # Core domain models and services

│ │ ├── src/

│ │ │ ├── domain/ # Domain models (User, Role, Session, etc.)

│ │ │ ├── services/ # Business logic services

│ │ │ └── index.ts # Public API exports

│ │ └── package.json

│ │

│ ├── shared/ # Shared types and utilities

│ │ ├── src/

│ │ │ ├── types/ # Shared TypeScript types

│ │ │ └── index.ts # Shared utilities

│ │ └── package.json

│ │

│ └── server/ # Express API server

│ ├── src/

│ │ ├── api/ # API routes and controllers

│ │ └── index.ts # Server entry point

│ └── package.json

│

├── apps/

│ └── admin-web/ # React admin dashboard

│ ├── src/

│ │ ├── features/ # Feature modules (auth, dashboard, users, etc.)

│ │ ├── components/ # Reusable components

│ │ ├── App.tsx # Main app component

│ │ └── main.tsx # App entry point

│ ├── index.html

│ └── package.json

│

├── package.json # Root workspace config

└── README.md # This file


\## 🎨 Design System



The UI follows a professional enterprise design system inspired by Odoo and Material Design:



\### Colors

\- \*\*Primary\*\*: `#1a73e8` (Professional blue)

\- \*\*Secondary\*\*: `#6c757d` (Slate gray)

\- \*\*Functional\*\*: Success (green), Warning (amber), Danger (red), Info (teal)



\### Typography

\- \*\*Primary Font\*\*: Inter

\- \*\*Base Size\*\*: 14px (Odoo-inspired)

\- \*\*Headings\*\*: 18-22px with 600 weight



\### Spacing

\- \*\*Base Unit\*\*: 4px grid system

\- \*\*Common Spacings\*\*: 8px, 16px, 24px, 32px



\### Components

\- Clean, data-dense interfaces

\- Maximum border-radius: 6px

\- Subtle shadows and animations

\- Professional icons only (no emojis)



\## 🔐 Authentication \& Security



\- JWT-based authentication with refresh tokens

\- Role-Based Access Control (RBAC) with 4 roles:

&nbsp; - \*\*Admin\*\*: Full system access

&nbsp; - \*\*Manager\*\*: Supervisory access with approvals

&nbsp; - \*\*Seller\*\*: Sales operations

&nbsp; - \*\*Viewer\*\*: Read-only access

\- Secure password hashing with bcrypt

\- HTTP-only cookies for token storage



\## 📊 Modules Implemented (Phase 1)



\### ✅ Week 1 Foundation

1\. \*\*Authentication System\*\*

&nbsp;  - User registration and login

&nbsp;  - JWT token management

&nbsp;  - Password reset functionality

&nbsp;  - Session management



2\. \*\*Role-Based Access Control\*\*

&nbsp;  - Permission matrix

&nbsp;  - Module-level access control

&nbsp;  - Role assignment system



3\. \*\*Dashboard Foundation\*\*

&nbsp;  - Main layout with sidebar navigation

&nbsp;  - KPI cards and metrics

&nbsp;  - Recent activity feed

&nbsp;  - Quick actions panel



4\. \*\*User Management\*\*

&nbsp;  - User CRUD operations

&nbsp;  - Role assignment interface

&nbsp;  - User status management

&nbsp;  - Department and job title tracking



\## 🚀 Getting Started



\### Prerequisites

\- Node.js 18+ 

\- npm or yarn

\- Git



\### Installation



1\. \*\*Clone the repository\*\*

&nbsp;  ```bash

&nbsp;  git clone <repository-url>

&nbsp;  cd BMS-Enterprise-Suite

