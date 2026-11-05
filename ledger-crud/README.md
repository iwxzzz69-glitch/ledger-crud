# Ledger

Control de profit de apuestas por torneo. Registrás torneos y apuestas, y la app calcula cuánto ganás o perdés, con una curva de profit acumulado, filtros por período y exportación a CSV.

Es un CRUD completo con API propia y base de datos real, pensado como proyecto de portafolio.

## Qué hace

- **Torneos**: crear, editar (nombre, fecha, juego) y eliminar. Al eliminar un torneo se eliminan sus apuestas, con opción de deshacer.
- **Apuestas**: crear, editar, eliminar y cambiar el estado con un clic (pendiente, ganada, perdida, anulada).
- **Profit calculado por la base de datos**: ganada = monto × (cuota − 1), perdida = −monto, el resto = 0.
- **Curva de profit acumulado** con cursor interactivo, navegable con teclado.
- **Filtros**: período (hoy, 7 días, 30 días, este mes, o cantidad de días, semanas o meses a elección), torneo y búsqueda de texto.
- Orden por columna, paginación, exportación a CSV, tema claro y oscuro, diseño responsive.
- Cada visitante recibe un identificador anónimo y trabaja con sus propios datos, así el demo público se puede editar sin que unas personas pisen los datos de otras.

## Stack

| Capa | Tecnología |
|---|---|
| Interfaz | HTML, CSS y JavaScript (módulos ES), sin framework. Gráfico en SVG propio |
| API | Funciones serverless de Vercel (Node.js) |
| Base de datos | Postgres en Neon |
| Desarrollo local | Postgres embebido (PGlite), sin configurar nada |

## Probarlo en tu computadora

Necesitás Node.js 20 o superior.

```bash
npm install
npm run dev
```

Abrí http://localhost:3000. Sin variables de entorno usa un Postgres embebido en memoria, así que los datos se reinician al apagar el servidor.

## Publicarlo (Vercel + Neon)

1. Subí esta carpeta a un repositorio de GitHub (sin `node_modules`).
2. En Vercel: **Add New → Project**, importá el repositorio y tocá **Deploy**.
3. En el proyecto, abrí **Storage → Create Database**, elegí **Neon (Postgres)** y conectala al proyecto. Vercel agrega la variable `DATABASE_URL` solo.
4. En **Deployments**, abrí el menú del último despliegue y elegí **Redeploy** para que tome la base.
5. Abrí la URL del proyecto y tocá **Cargar datos de ejemplo**.

Las tablas se crean solas la primera vez que se usa la API. El mismo esquema está en `db/schema.sql` para revisarlo.

## API

Todas las rutas piden la cabecera `x-owner-id` (el navegador la envía solo).

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/tournaments` | Lista los torneos |
| POST | `/api/tournaments` | Crea un torneo |
| PUT | `/api/tournaments?id=…` | Edita un torneo (campos parciales) |
| DELETE | `/api/tournaments?id=…` | Elimina un torneo y sus apuestas |
| GET | `/api/bets` | Lista las apuestas |
| POST | `/api/bets` | Crea una apuesta |
| PUT | `/api/bets?id=…` | Edita una apuesta (campos parciales) |
| DELETE | `/api/bets?id=…` | Elimina una apuesta |
| POST | `/api/seed` | Carga datos de ejemplo si el visitante no tiene datos |

## Estructura

```
api/          funciones serverless (una por recurso)
lib/          conexión a la base, esquema, validación y manejo de errores
public/       interfaz (index.html, styles.css, app.js, chart.js, api.js…)
db/           schema.sql generado desde lib/schema.js
scripts/      servidor local y exportador del esquema
```

## Decisiones de diseño

- **Validación en el servidor**: tipos, rangos y formatos se verifican antes de tocar la base, y la base los refuerza con `CHECK` y claves foráneas.
- **Aislamiento por visitante**: todas las consultas filtran por `owner_id`, y las inserciones de apuestas comprueban que el torneo pertenezca al mismo visitante.
- **Límites del demo**: 30 torneos y 300 apuestas por visitante.
- **Deshacer sin borrado lógico**: al eliminar se borra de verdad, y deshacer vuelve a crear los registros con el mismo identificador.

## Ideas para seguir

- Autenticación real para que los datos viajen entre dispositivos.
- Moneda configurable y metas de profit por mes.
- Pruebas automáticas de la API.
