"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { FormFeedback } from "@/components/forms/form-feedback";
import {
  changeOwnPasswordAction,
  updateOwnProfileAction,
} from "@/lib/actions/profile";
import {
  profileNameSchema,
  profilePasswordSchema,
  type ProfileNameFormInput,
  type ProfileNameInput,
  type ProfilePasswordFormInput,
  type ProfilePasswordInput,
} from "@/lib/validation/profile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProfileSettingsFormProps = {
  user: {
    name: string;
    username: string;
    role: string;
  };
};

export function ProfileSettingsForm({ user }: ProfileSettingsFormProps) {
  const router = useRouter();
  const [isSavingProfile, startProfileTransition] = useTransition();
  const [isSavingPassword, startPasswordTransition] = useTransition();
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const profileForm = useForm<ProfileNameFormInput, undefined, ProfileNameInput>({
    resolver: zodResolver(profileNameSchema),
    defaultValues: {
      name: user.name,
    },
  });

  const passwordForm = useForm<
    ProfilePasswordFormInput,
    undefined,
    ProfilePasswordInput
  >({
    resolver: zodResolver(profilePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  function onSubmitProfile(values: ProfileNameInput) {
    startProfileTransition(async () => {
      setProfileError(null);
      const result = await updateOwnProfileAction(values);

      if (!result.success) {
        setProfileError(result.message);
        toast.error(result.message);
        return;
      }

      setProfileError(null);
      toast.success(result.message);
      router.refresh();
    });
  }

  function onSubmitPassword(values: ProfilePasswordInput) {
    startPasswordTransition(async () => {
      setPasswordError(null);
      const result = await changeOwnPasswordAction(values);

      if (!result.success) {
        setPasswordError(result.message);
        toast.error(result.message);
        return;
      }

      setPasswordError(null);
      toast.success(result.message);
      passwordForm.reset({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your own display name here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-login-id">Login ID</Label>
              <Input id="profile-login-id" value={user.username} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-role">Role</Label>
              <Input id="profile-role" value={user.role} readOnly />
            </div>
          </div>
          <form
            className="space-y-4"
            onChangeCapture={() => {
              if (profileError) {
                setProfileError(null);
              }
            }}
            onSubmit={profileForm.handleSubmit(onSubmitProfile)}
          >
            <FormFeedback
              errors={profileForm.formState.errors}
              submitError={profileError}
              showValidationSummary={profileForm.formState.submitCount > 0}
            />
            <div className="space-y-2">
              <Label htmlFor="profile-name">Name</Label>
              <Input id="profile-name" {...profileForm.register("name")} />
              <p className="text-xs text-destructive">
                {profileForm.formState.errors.name?.message}
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? "Saving..." : "Save profile"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your own password with your current password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onChangeCapture={() => {
              if (passwordError) {
                setPasswordError(null);
              }
            }}
            onSubmit={passwordForm.handleSubmit(onSubmitPassword)}
          >
            <FormFeedback
              errors={passwordForm.formState.errors}
              submitError={passwordError}
              showValidationSummary={passwordForm.formState.submitCount > 0}
            />
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                {...passwordForm.register("currentPassword")}
              />
              <p className="text-xs text-destructive">
                {passwordForm.formState.errors.currentPassword?.message}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                {...passwordForm.register("newPassword")}
              />
              <p className="text-xs text-destructive">
                {passwordForm.formState.errors.newPassword?.message}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                {...passwordForm.register("confirmPassword")}
              />
              <p className="text-xs text-destructive">
                {passwordForm.formState.errors.confirmPassword?.message}
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSavingPassword}>
                {isSavingPassword ? "Saving..." : "Change password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
