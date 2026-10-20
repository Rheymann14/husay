import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes";

export default [
  // Public landing page: program list with the briefer in a right-side panel.
  route("/", "routes/home.tsx", [
    index("routes/home-index.tsx"),
    route("programs/:slug", "routes/program-detail.tsx"),
  ]),

  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),

  // Signed-in program management.
  ...prefix("admin", [
    layout("routes/admin/layout.tsx", [
      index("routes/admin/programs.tsx"),
      route("programs/new", "routes/admin/program-form.tsx", {
        id: "admin-program-new",
      }),
      route("programs/:programId/edit", "routes/admin/program-form.tsx", {
        id: "admin-program-edit",
      }),
      route("statuses", "routes/admin/statuses.tsx"),
      route("users", "routes/admin/users.tsx"),
      route("metrics", "routes/admin/metrics.tsx"),
      route("account", "routes/admin/account.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
