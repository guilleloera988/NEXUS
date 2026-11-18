# AINDEV NEXUS · SkillPass

Repositorio del MVP **SkillPass by AINDEV NEXUS** — *Applied Talent, Innovation & Venture Network 2026–2030*.

> **Prove what you can do.** Retos reales de empresas → evidencia → VATH validadas por un supervisor → competencias verificadas → SkillPass con credencial pública y QR.

## Contenido

| Ruta | Qué es |
|---|---|
| [`nexus-skillpass-mvp-final/`](nexus-skillpass-mvp-final) | **Aplicación MVP funcional** (Next.js 16 + Supabase/PostgreSQL con RLS). Empieza por su [README](nexus-skillpass-mvp-final/README.md). |
| [`nexus-skillpass-mvp-final/docs/`](nexus-skillpass-mvp-final/docs) | Arquitectura, base de datos, flujos UX, seguridad, deployment, guía de demo, roadmap, reporte de QA y matriz de estado. |
| `nexus-skillpass-mvp.zip` | MVP original de referencia (sin modificar; su contenido se importó como línea base en el historial de git). |
| `NEXUS.zip` | Imágenes de referencia de los 9 módulos («Paso 1…9 de 9»), sin modificar. |
| `.github/workflows/skillpass-quality.yml` | CI: lint, tipos, pruebas unitarias y de base de datos (PGlite y PostgreSQL 16), build y E2E. |

## Inicio rápido

```bash
cd nexus-skillpass-mvp-final
npm ci
npm run dev        # http://127.0.0.1:3000/demo  (no requiere Supabase ni secretos)
```

## Estado

- MVP funcional con los 18 módulos, demo guiada de 9 pasos y datos **ficticios** marcados como DEMO.
- Verificado con lint, TypeScript, 95 pruebas unitarias/BD, 39 pruebas de BD en PostgreSQL real, E2E de los flujos FLOW 01–10 (DEMO local y Supabase real) — ver [QA-REPORT](nexus-skillpass-mvp-final/docs/QA-REPORT.md).
- Pendiente para producción: proyecto Supabase, acceso a Vercel y autorización DNS para `skillpass.aindev.com.mx` — ver [DEPLOYMENT](nexus-skillpass-mvp-final/docs/DEPLOYMENT.md) y [STATUS](nexus-skillpass-mvp-final/docs/STATUS.md).

AINDEV TECH es la empresa tecnológica detrás de la plataforma.
