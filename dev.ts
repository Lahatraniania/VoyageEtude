import { createApp } from "./api/index";

const PORT = 3000;

const app = await createApp();
app.listen(PORT, "0.0.0.0", () => {
    console.log(`VoyageE server running on http://0.0.0.0:${PORT}`);
});