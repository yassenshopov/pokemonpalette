import { redirect } from "next/navigation";

export default function ApiKeysPage() {
  redirect("/account?tab=api");
}
