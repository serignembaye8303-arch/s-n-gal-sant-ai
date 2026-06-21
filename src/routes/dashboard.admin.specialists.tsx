import { createFileRoute } from "@tanstack/react-router";
import { RoleUsersManager } from "@/components/admin/RoleUsersManager";

export const Route = createFileRoute("/dashboard/admin/specialists")({
  component: SpecialistsPage,
});

function SpecialistsPage() {
  return (
    <RoleUsersManager
      scopedRole="specialiste"
      title="Spécialistes"
      intro="Gérez les comptes des spécialistes médicaux : créez, modifiez ou suspendez leurs accès."
    />
  );
}
