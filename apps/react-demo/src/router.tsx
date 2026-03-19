import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { EnvBar } from "./components/env-bar.tsx";
import { MswDevtools } from "./msw/devtools.tsx";
import { isMswActive } from "./msw/index.ts";
import { LoginPage } from "./routes/login.tsx";
import { DashboardPage } from "./routes/dashboard.tsx";
import { AdminPage } from "./routes/admin.tsx";

function RootLayout() {
  return (
    <>
      <EnvBar />
      <Outlet />
      {isMswActive() && <MswDevtools />}
    </>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: () => {
    if (localStorage.getItem("token")) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    if (!localStorage.getItem("token")) throw redirect({ to: "/login" });
  },
  component: DashboardPage,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  beforeLoad: () => {
    if (!localStorage.getItem("token")) throw redirect({ to: "/login" });
  },
  component: AdminPage,
});

const routeTree = rootRoute.addChildren([loginRoute, dashboardRoute, adminRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
