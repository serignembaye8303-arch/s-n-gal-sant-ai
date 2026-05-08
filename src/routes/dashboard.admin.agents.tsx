import { createFileRoute } from "@tanstack/react-router";
import { RoleUsersManager } from "@/components/admin/RoleUsersManager";

export const Route = createFileRoute("/dashboard/admin/agents")({
  component: AgentsPage,
});

function AgentsPage() {
  return (
    <RoleUsersManager
      scopedRole="agent"
      title="Agents de santé"
      intro="Gérez les comptes des agents de santé : créez, modifiez ou suspendez leurs accès."
    />
  );
}
