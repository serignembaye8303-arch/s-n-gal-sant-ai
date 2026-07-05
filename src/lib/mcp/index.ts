import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listUsersTool from "./tools/list-users";
import getMyProfileTool from "./tools/get-my-profile";
import listAiDiagnosticsTool from "./tools/list-ai-diagnostics";

// The OAuth issuer MUST be the direct Supabase host — the .lovable.cloud proxy
// fails RFC 8414 issuer validation in mcp-js. VITE_SUPABASE_PROJECT_ID is
// inlined by Vite at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "senegal-sante-ia-mcp",
  title: "Sénégal Santé-IA",
  version: "0.1.0",
  instructions:
    "Tools for the Sénégal Santé-IA platform. Use `get_my_profile` to identify the signed-in user, `list_users` (admin only) to manage accounts, and `list_ai_diagnostics` to inspect recent AI diagnostic logs.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProfileTool, listUsersTool, listAiDiagnosticsTool],
});
