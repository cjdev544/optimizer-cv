# CV Optimizer

Aplicación web y extensión de Chrome (Manifest V3) que usa IA para adaptar un CV a una oferta de empleo específica: reescribe y prioriza la experiencia real del candidato, genera un mensaje de presentación personalizado, detecta y responde automáticamente en el idioma de la oferta, y enmascara los datos personales antes de enviarlos a un proveedor de IA externo.

![Node](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

## Índice

- [Características](#características)
- [Arquitectura](#arquitectura)
- [Stack tecnológico](#stack-tecnológico)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Puesta en marcha](#puesta-en-marcha)
- [Variables de entorno](#variables-de-entorno)
- [API del backend](#api-del-backend)
- [Extensión de Chrome](#extensión-de-chrome)
- [Scripts disponibles](#scripts-disponibles)
- [Seguridad y privacidad](#seguridad-y-privacidad)
- [Limitaciones conocidas](#limitaciones-conocidas)

## Características

- **Optimización de CV con IA**: reescribe logros y habilidades priorizando lo relevante para la oferta, con verbos de acción, sin inventar experiencia, tecnologías, títulos ni fechas que no estén en el CV original.
- **Saludo personalizado**: genera un mensaje corto (LinkedIn / correo introductorio) que conecta el perfil real del candidato con la necesidad de la oferta.
- **Multilingüe y adaptativo**: detecta automáticamente el idioma de la oferta de empleo y responde íntegramente en ese idioma —aunque el CV original esté en otro—, usando terminología técnica localizada (ej. "Project Management" en inglés en vez de una traducción literal).
- **Enmascarado de PII**: nombre, email, teléfono y dirección del candidato se reemplazan por símbolos opacos antes de salir hacia el proveedor de IA, y se restauran en la respuesta final. El proveedor de IA nunca recibe el dato real.
- **Resultado editable**: tanto el CV optimizado como el saludo se pueden editar en el momento antes de copiarlos o exportarlos.
- **Exportación a PDF**: genera un PDF con formato de CV real (encabezado, secciones, viñetas), no un volcado de texto plano.
- **Extensión de Chrome (MV3)**: un content script extrae el texto de la oferta de la pestaña activa; el CV del usuario se guarda una sola vez en `chrome.storage`.
- **Un solo código para web y extensión**: el mismo componente de React se monta tanto en la SPA como en el popup de la extensión (Vertical Slice Architecture).

## Arquitectura

### Backend — Arquitectura Hexagonal + Screaming Architecture

Las carpetas gritan el caso de uso (`cv-optimization`), no la tecnología. Cada dependencia hacia el exterior (proveedor de IA, persistencia, enmascarado de PII) está detrás de un puerto (interfaz) definido en el dominio.

```
domain            → entidades (Cv, JobOffer), puertos (IAiService, ICvOptimizerRepository, IPiiMaskingService)
application       → casos de uso (OptimizeCvUseCase, GenerateGreetingUseCase) + DTOs con Zod
infrastructure    → adaptadores concretos:
                      ai/        OpenAiService      (implementa IAiService)
                      privacy/   RegexPiiMaskingService (implementa IPiiMaskingService)
                      persistence/ InMemoryCvOptimizerRepository (implementa ICvOptimizerRepository)
                      http/      Controllers + rutas Express
                      di/        Wiring manual (container.ts)
```

Flujo de una request (`POST /optimize`):

```
Express Controller → Zod valida el body → UseCase → Cv/JobOffer (entidades, validan invariantes)
   → PiiMaskingService.mask() → AiService.optimize() (OpenAI) → PiiMaskingService.unmask()
   → Repository.save() → 200 { id, createdAt, optimizedCvText }
```

Gracias a los puertos, cambiar de proveedor de IA (OpenAI → Gemini, por ejemplo) o de almacenamiento (memoria → base de datos) es escribir un nuevo adaptador, sin tocar los casos de uso.

### Frontend — Vertical Slice Architecture

El feature `cv-optimizer` contiene todo lo que necesita de punta a punta: componentes, hooks y servicios. No hay carpetas globales de "components" o "hooks" a nivel de toda la app.

```
src/features/cv-optimizer/
  components/   UI (CvOptimizerPanel, OptimizeButton, OptimizedResultPanel, GreetingResultPanel, ...)
  hooks/        estado + fetch (useOptimizeCv, useGenerateGreeting, useStoredCv)
  services/     lógica sin React (contentScript.ts, buildCvPdf.ts)

src/shared/      infraestructura transversal reutilizable entre features
  lib/           chromeRuntime.ts (mensajería con la extensión), storage.ts, messages.ts
  config/        env.ts
```

`CvOptimizerPanel` es el único componente de UI real; tanto `frontend/src/App.tsx` (app web) como `frontend/extension/src/popup/popup.tsx` (popup de la extensión) solo lo montan — cero duplicación de lógica entre ambos targets.

### Doble build de Vite

| Config | Entrada | Salida | Uso |
|---|---|---|---|
| `vite.config.ts` | `index.html` → `src/main.tsx` | `frontend/dist/` | App web (SPA) |
| `vite.config.extension.ts` | `extension/manifest.json` (vía `@crxjs/vite-plugin`) | `frontend/dist-extension/` | Extensión de Chrome MV3 |

## Stack tecnológico

| Capa | Tecnologías |
|---|---|
| Backend | Node.js, Express, TypeScript, Zod, SDK oficial de `openai` |
| Frontend | React 18, Vite, Tailwind CSS, TypeScript, `jsPDF`, `@crxjs/vite-plugin` |
| Extensión | Chrome Manifest V3 (`chrome.storage`, `chrome.tabs`, `chrome.runtime`) |
| Infraestructura | Docker, Docker Compose, nginx (sirve el build estático del frontend) |

## Estructura del proyecto

```
optimizer-cv/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   └── src/
│       ├── app.ts, server.ts, config/env.ts
│       ├── shared/               errores y middleware de Express comunes
│       └── modules/cv-optimization/
│           ├── domain/           entidades + puertos
│           ├── application/      casos de uso + DTOs
│           └── infrastructure/   ai/, privacy/, persistence/, http/, di/
└── frontend/
    ├── Dockerfile, nginx.conf
    ├── vite.config.ts, vite.config.extension.ts
    ├── extension/                manifest.json, popup, content script, background
    └── src/
        ├── App.tsx, main.tsx     entrada de la app web
        ├── features/cv-optimizer/  slice completo (components/hooks/services)
        └── shared/                config y libs transversales (chrome runtime, storage)
```

## Puesta en marcha

### Opción A — Docker (recomendado)

Requiere Docker y Docker Compose.

```bash
cp backend/.env.example backend/.env
# completar AI_PROVIDER_API_KEY en backend/.env con una key real de OpenAI

docker compose up --build
```

- Backend: `http://localhost:4000`
- Frontend web: `http://localhost:8081`
- Parar: `docker compose down`
- Logs: `docker compose logs -f`

> La extensión de Chrome **no** corre dentro de Docker (no tiene sentido "levantar" un artefacto que solo existe cargado en un navegador). Se construye aparte — ver [Extensión de Chrome](#extensión-de-chrome).

### Opción B — Manual / desarrollo local

Requiere Node.js 20+.

```bash
npm install                          # instala backend + frontend (npm workspaces)

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# completar AI_PROVIDER_API_KEY en backend/.env

npm run dev:backend                  # http://localhost:4000
npm run dev:frontend                 # http://localhost:5173 (en otra terminal)
```

## Variables de entorno

### `backend/.env`

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `4000` | Puerto del servidor Express |
| `ALLOWED_ORIGIN` | `http://localhost:5173` | Origin permitido por CORS (el de la app web/extensión) |
| `AI_PROVIDER_API_KEY` | *(requerida)* | API key del proveedor de IA |
| `AI_PROVIDER_BASE_URL` | `https://api.openai.com/v1` | Base URL compatible con la API de OpenAI (permite gateways/proxies compatibles) |
| `AI_PROVIDER_MODEL` | `gpt-4o-mini` | Modelo a usar |

### `frontend/.env`

| Variable | Default | Descripción |
|---|---|---|
| `VITE_API_URL` | `http://localhost:4000` | URL base del backend (se inyecta en build time) |

## API del backend

Base URL: `http://localhost:4000`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Liveness check (`{ "status": "ok" }`) |
| `POST` | `/api/cv-optimization/optimize` | Optimiza el CV según la oferta |
| `POST` | `/api/cv-optimization/generate-greeting` | Genera el saludo/mensaje de presentación |

Ambos endpoints `POST` esperan el mismo body:

```json
{
  "cvText": "texto del CV, mínimo 50 caracteres",
  "jobOfferText": "texto de la oferta de empleo, mínimo 30 caracteres"
}
```

**`POST /optimize` → 200**
```json
{
  "id": "uuid",
  "createdAt": "2026-07-10T12:00:00.000Z",
  "optimizedCvText": "..."
}
```

**`POST /generate-greeting` → 200**
```json
{ "greeting": "..." }
```

**Errores**
- `400` — validación de Zod (`{ "error": "ValidationError", "issues": [...] }`)
- `500` — error del proveedor de IA u otro error interno (`{ "error": "InternalServerError", "message": "..." }`)

## Extensión de Chrome

```bash
npm run build:extension        # genera frontend/dist-extension/
# o en modo watch, para desarrollo:
npm run dev:extension
```

Luego, en Chrome: `chrome://extensions` → activar **Modo desarrollador** → **Cargar descomprimida** → seleccionar `frontend/dist-extension`.

El `manifest.json` declara `host_permissions` solo para `http://localhost:4000/*`. Si el backend se despliega en otro dominio, hay que actualizar esa lista antes de publicar la extensión.

## Scripts disponibles

Desde la raíz (usan npm workspaces):

| Script | Descripción |
|---|---|
| `npm run dev:backend` | Backend en modo watch (`ts-node-dev`) |
| `npm run dev:frontend` | App web en modo dev (Vite) |
| `npm run dev:extension` | Build de la extensión en modo watch |
| `npm run build:backend` | Compila el backend a `backend/dist` |
| `npm run build:frontend` | Build de producción de la app web |
| `npm run build:extension` | Build de producción de la extensión |

## Seguridad y privacidad

- **Enmascarado de PII antes de salir a terceros**: `RegexPiiMaskingService` detecta nombre (primera línea del CV, por convención), email, teléfono y dirección, y los reemplaza por símbolos opacos (`§0§`, `§1§`, ...) antes de que el CV llegue al proveedor de IA. La respuesta se desenmascara localmente antes de devolverla al usuario. El proveedor de IA nunca recibe el dato real.
- **Regla de cero alucinación**: los prompts prohíben explícitamente inventar experiencia, tecnologías, títulos, certificaciones o fechas de empleo que no estén en el CV original — incluso al traducir a otro idioma.
- Esto es una **capa técnica de defensa en profundidad**, no una certificación de cumplimiento GDPR/RGPD por sí sola. Un cumplimiento real también requiere una base legal para el tratamiento de datos, un DPA con el proveedor de IA, política de privacidad, etc.

## Limitaciones conocidas

- **Enmascarado de PII heurístico, no NER real**: detecta el nombre del propio candidato (primera línea del CV) pero no nombres de terceros mencionados en el cuerpo (ex-jefes, referencias). La detección de teléfono/dirección puede tener falsos negativos con formatos atípicos.
- **Persistencia en memoria**: `InMemoryCvOptimizerRepository` no usa una base de datos — el historial de CVs optimizados se pierde al reiniciar el backend. Pensado para reemplazarse por un adaptador real sin tocar los casos de uso.
- **Sin autenticación**: no hay usuarios ni sesiones; cualquiera con acceso al backend puede llamar a los endpoints.
- **Sin parser de entrada**: la carga de CV en la UI es texto plano pegado a mano; no hay parser de PDF/DOCX de entrada todavía (sí hay exportación a PDF de salida).
