import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        // no necesitamos proxy si el backend está en la URL correcta
        host: true,
        port: 5173,
    },
});
