import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    // Quick Cloudflare Tunnels front the dev server with a random
    // *.trycloudflare.com host; Vite blocks unknown Hosts by default.
    allowedHosts: [".trycloudflare.com"],
    // Proxy the API through this same origin so only one tunnel/URL is
    // needed publicly, and the backend never has to be exposed directly.
    proxy: Object.fromEntries(
      ["/login", "/health", "/dashboard", "/bookings", "/approvals", "/employees", "/holidays", "/export", "/teams"]
        .map((path) => [path, "http://localhost:8000"])
    ),
  },
})
