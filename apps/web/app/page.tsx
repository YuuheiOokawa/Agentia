import { redirect } from "next/navigation";

/** docs/08_SCREEN_DESIGN.md #0: Dashboard is the app's entry point. */
export default function RootPage() {
  redirect("/dashboard");
}
