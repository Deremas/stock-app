import { ProfileSettingsForm } from "@/components/forms/profile-settings-form";
import { PageHeader } from "@/components/app-shell/page-header";
import { requireSession } from "@/lib/auth/session";

export default async function ProfilePage() {
  const user = await requireSession();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Update your own name and password here."
      />
      <ProfileSettingsForm
        user={{
          name: user.name,
          username: user.username,
          role: user.role,
        }}
      />
    </div>
  );
}
