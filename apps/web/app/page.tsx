import { redirect } from "next/navigation";

/** docs/17_MVP_PLAN.md #1: the MVP has no dashboard yet, so the app opens straight into the office. */
export default function RootPage() {
  redirect("/office");
}
