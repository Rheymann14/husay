import { redirect } from "react-router";

import { destroySession } from "~/lib/auth.server";
import type { Route } from "./+types/logout";

export async function action({ request }: Route.ActionArgs) {
  throw redirect("/", {
    headers: { "Set-Cookie": await destroySession(request) },
  });
}

export function loader() {
  throw redirect("/");
}
