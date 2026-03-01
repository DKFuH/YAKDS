# RENDER_PROTOCOL.md

## Render-Worker-Protokoll

**Stand:** Sprint 0

---

## Grundprinzip

Der Render-Worker ist ein **externer Prozess** — entkoppelt vom `planner-api`.
Er registriert sich aktiv, pollt Jobs per HTTPS-Pull und liefert Ergebnisse zurück.
Die API kennt den Worker nur über sein Auth-Token.

---

## Ablauf (End-to-End)

```
Browser                planner-api              render-worker
   │                        │                        │
   │ POST /render-jobs       │                        │
   │──────────────────────►  │                        │
   │                        │ Job: queued             │
   │                        │                        │
   │                        │◄─── POST /workers/register
   │                        │     { worker_id, capabilities }
   │                        │                        │
   │                        │◄─── GET /render-jobs/next
   │                        │     Authorization: Bearer <worker-token>
   │                        │                        │
   │                        │ Job: assigned           │
   │                        ├──────────────────────► │
   │                        │  { job_id, scene_payload }
   │                        │                        │
   │                        │◄─── PATCH /render-jobs/:id/status
   │                        │     { status: "running" }
   │                        │                        │ [rendert...]
   │                        │◄─── POST /render-jobs/:id/result
   │                        │     { image_url / binary }
   │                        │                        │
   │                        │ Job: done               │
   │◄── GET /render-jobs/:id│                        │
   │    { status, image_url }│                        │
```

---

## Job-Status-Übergänge

```
queued → assigned → running → done
                           → failed
queued → failed (Timeout)
assigned → queued (Worker-Disconnect ohne Ergebnis, nach Timeout)
```

---

## Kernobjekte

### `RenderJob`

```typescript
interface RenderJob {
  id: string;
  project_id: string;
  status: RenderJobStatus;
  scene_payload: ScenePayload | null;
  worker_id: string | null;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

type RenderJobStatus = 'queued' | 'assigned' | 'running' | 'done' | 'failed';
```

### `RenderJobResult`

```typescript
interface RenderJobResult {
  id: string;
  job_id: string;
  image_url: string;
  width_px: number;
  height_px: number;
  render_time_ms: number;
  created_at: string;
}
```

### `RenderNode` (Worker-Registrierung)

```typescript
interface RenderNode {
  id: string;
  worker_token: string;            // Bearer-Token (gehasht gespeichert)
  hostname: string;
  capabilities: RenderCapability[];
  last_heartbeat: string;
  status: 'idle' | 'busy' | 'offline';
}

type RenderCapability = 'blender' | 'threejs-ssr' | 'cycles' | 'eevee';
```

---

## Scene Payload

Das Format, das der Worker vom `planner-api` erhält.

```typescript
interface ScenePayload {
  format_version: '1.0';
  room: {
    boundary: Vertex[];
    ceiling_height_mm: number;
    ceiling_constraints: CeilingConstraint[];
  };
  objects: SceneObject[];
  camera: CameraSetup;
  render_settings: RenderSettings;
}

interface SceneObject {
  id: string;
  type: 'cabinet' | 'appliance' | 'reference_geometry';
  position: { x_mm: number; y_mm: number; z_mm: number };
  rotation_deg: number;
  dimensions: { width_mm: number; height_mm: number; depth_mm: number };
  material_hint: string | null;    // z.B. "wood_white", "steel"
}

interface CameraSetup {
  preset: 'perspective_3quarter' | 'top_down' | 'front';
  custom?: { position: Vector3D; target: Vector3D; fov_deg: number };
}

interface RenderSettings {
  width_px: number;
  height_px: number;
  quality: 'preview' | 'standard' | 'high';
  format: 'jpg' | 'png';
}
```

---

## API-Endpunkte

```
# Client (Browser)
POST /api/v1/projects/:id/render-jobs
  Body: { camera_preset, render_settings }
  → RenderJob

GET /api/v1/render-jobs/:id
  → RenderJob + RenderJobResult (wenn done)

# Worker (intern)
POST /api/v1/workers/register
  Body: { hostname, capabilities }
  → { worker_id, worker_token }

GET /api/v1/render-jobs/next
  Authorization: Bearer <worker-token>
  → RenderJob + ScenePayload | 204 No Content

PATCH /api/v1/render-jobs/:id/status
  Authorization: Bearer <worker-token>
  Body: { status: 'running' | 'failed', error_message? }
  → RenderJob

POST /api/v1/render-jobs/:id/result
  Authorization: Bearer <worker-token>
  Body: multipart/form-data { image: File } | { image_url: string }
  → RenderJobResult
```

---

## Timeout-Handling

| Zustand | Timeout | Aktion |
|---|---|---|
| `queued` | 1 h | Job bleibt, Worker wird erwartet |
| `assigned` | 5 min | Job zurück auf `queued` |
| `running` | 30 min | Job auf `failed` setzen |

---

## Sicherheit

- Worker-Token ist ein signiertes JWT mit `worker_id` + `issued_at`
- Token wird **gehasht** in der DB gespeichert
- Kein direkter Datenbankzugriff durch Worker
- Scene Payload enthält **keine** Kundendaten (Name, Preis, etc.)
- Ergebnis-Upload nur für den `worker_id`, der den Job hält
