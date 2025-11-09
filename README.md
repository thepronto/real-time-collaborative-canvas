# 🖌️ Real-Time Collaborative Canvas

A small multi-user drawing app built from scratch using **Node.js**, **WebSockets (Socket.io)**, and the **HTML5 Canvas API** — no frontend frameworks or drawing libraries involved.  
Each user gets their own interactive layer, while a shared master canvas keeps everyone’s drawings synchronized in real time.

---

## 🚀 Setup & Run

1. Clone this repository  
   ```bash
   git clone https://github.com/thepronto/real-time-collaborative-canvas
   cd real-time-collaborative-canvas
   ```

2. Install dependencies  
   ```bash
   npm install
   ```

3. Start the server  
   ```bash
   npm start
   ```
4. Or you can run both at once:
    
   ```bash
   npm install && start
   ```
4. Open the app  
   Go to **http://localhost:5050** in your browser.

That’s it — no extra build steps. The client scripts load directly in the browser as ES modules.

---

## 🧑‍🤝‍🧑 Testing with Multiple Users

To simulate multiple users:

1. Open **two or more** browser windows or tabs and visit `http://localhost:5050`.  
2. You’ll notice each user gets assigned a unique color automatically.  
3. Try drawing on one tab — the strokes appear instantly on all others.  
4. The user list in the sidebar updates whenever someone joins or leaves.  
5. Undo, redo, and clear actions apply globally to everyone’s shared view.

## 🌍 Live Demo (Render Deployment)

You can try the live version right here:

👉 Open Collaborative Canvas on Render

[(Link)](https://real-time-collaborative-canvas.onrender.com/)

🧑‍🤝‍🧑 Testing Multi-User Collaboration on Render

1. Open the link above in your browser.
2. Open another tab or another device using the same URL.
3. You’ll see each user show up with a unique color in the “Online Users” list.
4. Start drawing — strokes appear live on all connected users’ screens.
5. You can also test Undo, Redo, and Clear, which apply globally to everyone.

---

## ⚙️ Tech Breakdown

- **Frontend:** Vanilla JavaScript (ES Modules) + HTML5 Canvas  
- **Backend:** Node.js + Express + Socket.io  
- **Architecture:**  
  - `canvas.js` → handles local rendering & drawing logic  
  - `websocket.js` → manages all real-time socket events  
  - `main.js` → connects UI, tools, and socket events  
  - `server.js` → WebSocket server + Express static host  
  - `drawing-state.js` → manages strokes, undo/redo, and persistence  

---

## 🧩 Known Limitations / Bugs
  
- Undo/redo operates at a **global stroke level** (per completed stroke), not partial lines.  
- Currently all sessions share the same “room.” Multi-room support could be added later.  

---

## ⏱️ Time Spent

Roughly **2½ to 3 days**

---
## **Bonus Features**
- Mobile touch support for drawing
- Drawing persistence (save/load sessions)
- Performance metrics (FPS counter, latency display)

## 🪄 Notes

This project was built to demonstrate:
- efficient canvas handling without libraries,  
- real-time collaboration via WebSockets, and  
- clean modular design with clear separation of concerns.

Feel free to extend it — rooms, shape tools, or persistent session storage would be great next steps.  
