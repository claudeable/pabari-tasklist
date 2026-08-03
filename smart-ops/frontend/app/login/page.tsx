import { redirect } from "next/navigation";

// Login is disabled — all authentication goes through Pabari Workspace SSO.
export default function LoginPage() {
  redirect("https://pabari-workspace.up.railway.app");
}
