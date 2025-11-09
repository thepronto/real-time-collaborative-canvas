# 🧩 ARCHITECTURE.md
### Real-Time Collaborative Drawing Canvas

## **1. Data Flow Diagram**

```text
 ┌──────────────┐             ┌────────────────┐             ┌──────────────┐
 │   User A     │             │   Server (WS)  │             │   User B     │
 │──────────────│             │────────────────│             │──────────────│
 │ pointerdown  │             │                │             │              │
 │ → drawStream(begin) ─────► │ broadcast →────► drawStream(begin)          │
 │ draw locally (layer[A])    │                │ draw on layer[A]           │
 │                            │                │                            │
 │ pointermove                │                │ pointermove                │
 │ → drawStream(point) ──────►│ broadcast →────► drawStream(point)          │
 │ draw locally (layer[A])    │                │ draw on layer[A]           │
 │                            │                │                            │
 │ pointerup                  │                │                            │
 │ → stroke(path) ───────────►│ append op      │                            │
 │                            │ op broadcast → │ draw committed stroke      │
 │ clear layer[A]             │                │ clear layer[A]             │
 │                            │                │                            │
 │ click undo                 │                │                            │
 │ → undo ───────────────────►│ pop op, emit opsSync ─────► rebuild canvas  │
 │                            │                │                            │
 │ all users rebuild           ◄────────────── opsSync ──────────────────────┘
```

Each client:
- Draws locally on its **own transparent canvas layer** for immediate feedback.
- Streams normalized coordinates (`x`,`y` ∈ [0..1]) via `drawStream` events for live updates.
- Sends full stroke path at the end via `stroke`.

The server:
- Relays live drawStream messages for others to visualize.
- On `stroke`, assigns an `opId`, stores it, clears redo stack, and broadcasts a committed operation (`op`).
- On `undo/redo`, updates `ops` and broadcasts `opsSync` (the full authoritative state).

---

## **2. WebSocket Protocol**

| Event | Direction | Payload | Description |
|-------|------------|----------|-------------|
| `cursor` | C → S | `{ x, y }` | Sends user’s current pointer position (normalized). |
| `drawStream` | C ↔ S | `{ type: 'begin'|'point'|'end', x, y, color?, width? }` | Streams live stroke progress for all users’ layers. |
| `stroke` | C → S | `{ path: [{x,y},…], meta:{color,width} }` | Finalizes a stroke. Server commits it as an operation. |
| `undo` / `redo` / `clear` | C → S | — | Requests global undo/redo/clear. |
| `op` | S → C | `{ opId, kind:'stroke', userId, path, meta }` | New committed stroke broadcast. |
| `opsSync` | S → C | `[op,…]` | Full authoritative operation history. |
| `init` | S → C | `{ id, users, ops }` | Initial state for new user. |
| `users` | S → C | `{ [id]:{name,color} }` | Current user list. |
| `removeLayer` | S → C | `{ id }` | Remove disconnected user’s layer. |

---

## **3. Undo / Redo Strategy**

### Server state

```js
let ops = [];       // committed operations
let redoStack = []; // undone operations
```

### Actions

| Action | Effect | Broadcast |
|---------|---------|------------|
| `stroke` | push op → clear redo | `op` |
| `undo` | pop op → push redo | `opsSync` |
| `redo` | pop redo → push op | `opsSync` |
| `clear` | empty both stacks | `clear` |

Clients rebuild the committed canvas by replaying all operations from `opsSync`.

---

## **4. Performance Decisions**

| Optimization | Reason |
|---------------|--------|
| **Per-user layers** | Isolates strokes; prevents path collisions and artifacts. |
| **Local rendering** | Immediate feedback without latency. |
| **Normalized coordinates** | Resolution-independent drawing. |
| **Operation replay** | Compact vector-based state sync instead of large images. |
| **DPR transforms** | High-DPI rendering consistency. |
| **Stateless server** | No heavy pixel processing; scalable. |

---

## **5. Conflict Resolution**

1. Each user draws on their own layer — no conflicts during active strokes.  
2. The server timestamps and orders all committed strokes (opId).  
3. Clients replay ops in order → deterministic final state.  
4. Last committed stroke renders on top visually (natural stacking).

---

## **6. Layer Stack Diagram**

```text
+----------------------------------------------------------+  ← cursorCanvas (top, cursors only)
|                 remote cursors (white outline)           |
+----------------------------------------------------------+
| User Layer N (transparent, live strokes)                 |
| User Layer N-1                                           |
| ...                                                      |
| User Layer 1                                             |
+----------------------------------------------------------+
| Committed Canvas (final strokes from all ops)            |
+----------------------------------------------------------+
| HTML Background / Page                                   |
+----------------------------------------------------------+
```

Each layer is transparent and composited visually by the browser. Only the committed canvas is permanent; all user layers are transient for live updates.

---

## ✅ Summary

| Component | Role |
|------------|------|
| **Client (Vanilla JS)** | Handles UI, drawing, event capture, rendering, WebSocket comms. |
| **Server (Node + Socket.io)** | Maintains authoritative state, resolves undo/redo, broadcasts updates. |
| **Layers** | Isolated active strokes for each user. |
| **Committed Canvas** | Global finalized state. |

This architecture ensures **smooth, conflict-free real-time collaboration** with **deterministic undo/redo**, fully built in **vanilla JavaScript**.
