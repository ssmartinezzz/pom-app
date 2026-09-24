# POM App

POM App is the client for [POM Platform](https://github.com/ssmartinezzz/pom-platform). With it you create QA projects, extract elements from web pages, generate Page Object Model code and tests, and review AI analyses. The same codebase runs on web, Android, and iOS.

## Stack

- Expo 54, React Native 0.81, Expo Router 6
- TypeScript, Zustand, Axios
- Jest (`jest-expo`)

## Features

- Email and password authentication. The token is kept in SecureStore on native and in localStorage on web.
- Projects with folders, a browser selection, and auth configuration
- Page extraction with pre-extraction steps (fill, click, and so on)
- Code generation, with a preview of the generated files and a ZIP download
- AI analysis results that you can apply back to the generated code
- API endpoint testing support

## Requirements

- Node.js 20+
- A running POM Platform gateway (default `http://localhost:9080`)
- Expo Go or an emulator, if you want to run it on a device

## How to use

```bash
npm install
EXPO_PUBLIC_API_URL=http://localhost:9080 npm run web
```

Other targets:

```bash
npm run android
npm run ios
npm start          # Expo dev server with QR code
npm test
```

When you run on a physical device, point `EXPO_PUBLIC_API_URL` at your machine's LAN IP instead of `localhost`, and add that origin to the backend's `CORS_ORIGINS`.

### Configuration

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | POM Platform gateway URL, without `/api/v1` (default `http://localhost:9080`) |

Or copy `.env.example` to `.env` and edit it. `.env` is ignored by git.

## Project structure

```
app/            Expo Router screens: (auth), (tabs), project, extraction, generation, analysis, endpoint
src/api/        HTTP client and API modules
src/stores/     Zustand stores
src/components/ UI components
src/hooks/      Custom hooks
src/theme/      Colors and spacing
src/types/      Shared types
src/utils/      Storage, formatting, and framework helpers
```

## License

[MIT](LICENSE)
