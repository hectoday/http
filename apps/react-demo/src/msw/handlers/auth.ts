import { http, delay, passthrough } from "msw";

export const authHandlers = [
  http.post("/api/auth/login", async () => {
    await delay(3000);
    return passthrough();
  }),

  http.post("/api/auth/signup", async () => {
    await delay(3000);
    return passthrough();
  }),

  http.get("/api/auth/me", async () => {
    await delay(3000);
    return passthrough();
  }),
];
