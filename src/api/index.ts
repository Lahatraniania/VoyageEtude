// api/index.ts
// Point d'entrée Vercel : importe createApp depuis server.ts
import { createApp } from "..//..//server";

// Vercel attend un export par défaut (l'app Express)
export default await createApp();