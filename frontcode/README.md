# Sathcode — web client

React + TypeScript + Vite + Tailwind. See the [repository root README](../README.md) for product context and how the app connects to the API.

## Scripts

- `npm run dev` — dev server (proxies `/api` to `http://localhost:3001` by default)
- `npm run build` — production build
- `npm run preview` — preview production build locally
- `npm run lint` — ESLint

## Configuration

- **Vite proxy**: `vite.config.ts` — override backend target with `VITE_API_PROXY_TARGET` if needed.
- **Production API**: set `VITE_API_URL` (no trailing slash) so fetches resolve to your deployed API.

This project uses the [React Compiler](https://react.dev/learn/react-compiler) via the Vite + Babel setup.
