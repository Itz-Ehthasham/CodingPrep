# Sathcode

**Sathcode** is an AI-powered coding preparation platform: a full-stack web application that helps people learn and improve programming skills through personalized, AI-driven guidance.

## Vision

The platform provides structured learning paths across topics such as **JavaScript** and **Python**, combining interactive practice with real-time feedback. It integrates **OpenAI** (or compatible) language models for intelligent hints, explanations, and adaptive question generation based on the user’s performance.

The system tracks progress, surfaces strengths and weaknesses, and presents actionable insights through a **dynamic dashboard**. Planned and in-progress capabilities include:

- Built-in **code editor** with feedback loops  
- **Mock interview** simulations  
- **Streak-based** learning and habit tracking  

The goal is a single place for interview prep and continuous skill development.

## Tech stack

| Layer    | Current choice |
| -------- | -------------- |
| Frontend | React 19, **TypeScript**, Vite, Tailwind CSS |
| Backend  | Node.js, **Express**, JavaScript (TypeScript migration planned to align full stack) |
| Database | **MongoDB** via Mongoose (optional in dev until `MONGODB_URI` is set) |
| AI       | OpenAI API (to be wired for hints, generation, and explanations) |

This matches the **MERN** style (Mongo, Express, React, Node) with TypeScript on the client; the API layer can move to TypeScript as the codebase grows.

## Repository layout

```text
Sathcode/
├── frontcode/    # React + Vite client
├── backcode/     # Express API
└── README.md
```

## Local development

**API** (terminal 1):

```bash
cd backcode
npm install
npm run dev
```

Default API URL: `http://localhost:3001`. Copy `backcode/.env.example` to `.env` and adjust `PORT` / `FRONTEND_ORIGIN` as needed.

**Web app** (terminal 2):

```bash
cd frontcode
npm install
npm run dev
```

The Vite dev server proxies `/api` to the backend. For production builds, set `VITE_API_URL` to your deployed API origin (see `frontcode/.env.example` if present).

## Environment notes

- **Backend**: `FRONTEND_ORIGIN` should match the URL of the Vite dev server (e.g. `http://localhost:5173`).  
- **MongoDB**: set `MONGODB_URI` when you are ready to persist users, progress, and generated content.  
- **OpenAI**: API keys and server-side routes should live only in the backend; never commit secrets.

## License

See individual packages for license fields (e.g. `backcode/package.json`).
