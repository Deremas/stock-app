"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { FormFeedback } from "@/components/forms/form-feedback";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createUserAction, updateUserAction } from "@/lib/actions/users";
import { APP_ROLES } from "@/lib/rbac";
import type { UserFormOptions } from "@/lib/types";
import {
  userSchema,
  userUpdateSchema,
} from "@/lib/validation/user";

type UserEditorFormValues = {
  id: string;
  name: string;
  email: string;
  username: string;
  phone: string;
  password: string;
  role: "ADMIN" | "SALES";
  branchIds: string[];
  defaultBranchId: string;
};

type UserFormProps = {
  options: UserFormOptions;
  intent?: "create" | "edit";
  initialValues?: Partial<UserEditorFormValues>;
};

const createDefaultValues: UserEditorFormValues = {
  id: "",
  name: "",
  email: "",
  username: "",
  phone: "",
  password: "",
  role: "SALES",
  branchIds: [],
  defaultBranchId: "",
};

export function UserForm({
  options,
  intent = "create",
  initialValues,
}: UserFormProps) {
  const createDialog = useCreateDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEdit = intent === "edit";
  const defaultValues = useMemo<UserEditorFormValues>(() => {
    const initialBranchIds =
      initialValues?.branchIds?.length
        ? initialValues.branchIds
        : options.branches[0]
          ? [options.branches[0].id]
          : [];
    const initialDefaultBranchId =
      initialValues?.defaultBranchId && initialBranchIds.includes(initialValues.defaultBranchId)
        ? initialValues.defaultBranchId
        : initialBranchIds[0] ?? "";

    return {
      ...createDefaultValues,
      branchIds: initialBranchIds,
      defaultBranchId: initialDefaultBranchId,
      ...(initialValues ?? {}),
    };
  }, [initialValues, options.branches]);
  const resolver = zodResolver(
    isEdit ? userUpdateSchema : userSchema,
  ) as Resolver<UserEditorFormValues>;

  const form = useForm<UserEditorFormValues>({
    resolver,
    defaultValues,
  });
  const selectedBranchIds = form.watch("branchIds");
  const availableDefaultBranches = options.branches.filter((branch) =>
    selectedBranchIds.includes(branch.id),
  );

  useEffect(() => {
    const currentDefaultBranchId = form.getValues("defaultBranchId");

    if (
      availableDefaultBranches.length > 0 &&
      !availableDefaultBranches.some((branch) => branch.id === currentDefaultBranchId)
    ) {
      form.setValue("defaultBranchId", availableDefaultBranches[0]?.id ?? "", {
        shouldDirty: true,
      });
    }

    if (availableDefaultBranches.length === 0 && currentDefaultBranchId) {
      form.setValue("defaultBranchId", "", {
        shouldDirty: true,
      });
    }
  }, [availableDefaultBranches, form]);

  function handleCancel() {
    setSubmitError(null);
    form.reset(defaultValues);
    createDialog?.close();
  }

  function handleBranchToggle(branchId: string, checked: boolean) {
    const nextBranchIds = checked
      ? [...selectedBranchIds, branchId]
      : selectedBranchIds.filter((value) => value !== branchId);

    form.setValue("branchIds", nextBranchIds, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function onSubmit(values: UserEditorFormValues) {
    startTransition(async () => {
      setSubmitError(null);
      const result = isEdit
        ? await updateUserAction({
            id: values.id,
            name: values.name,
            email: values.email,
            username: values.username,
            phone: values.phone,
            password: values.password,
            role: values.role,
            branchIds: values.branchIds,
            defaultBranchId: values.defaultBranchId,
          })
        : await createUserAction({
            name: values.name,
            email: values.email,
            username: values.username,
            phone: values.phone,
            password: values.password,
            role: values.role,
            branchIds: values.branchIds,
            defaultBranchId: values.defaultBranchId,
          });

      if (!result.success) {
        setSubmitError(result.message);
        toast.error(result.message);
        return;
      }

      setSubmitError(null);
      toast.success(result.message);
      form.reset(defaultValues);
      router.refresh();
      createDialog?.close();
    });
  }

  if (options.branches.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Create at least one active branch before adding users.
        </p>
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => createDialog?.close()}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onChangeCapture={() => {
        if (submitError) {
          setSubmitError(null);
        }
      }}
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <FormFeedback
        errors={form.formState.errors}
        submitError={submitError}
        showValidationSummary={form.formState.submitCount > 0}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="user-role">Role</Label>
          <Select id="user-role" {...form.register("role")}>
            {APP_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </Select>
          <p className="text-xs text-destructive">{form.formState.errors.role?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-default-branch">Default branch</Label>
          <Select
            id="user-default-branch"
            {...form.register("defaultBranchId")}
            disabled={availableDefaultBranches.length === 0}
          >
            {availableDefaultBranches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
          <p className="text-xs text-destructive">
            {form.formState.errors.defaultBranchId?.message}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-name">Name</Label>
          <Input id="user-name" placeholder="Jane Doe" {...form.register("name")} />
          <p className="text-xs text-destructive">{form.formState.errors.name?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-email">Email</Label>
          <Input
            id="user-email"
            type="email"
            placeholder="jane@example.com"
            {...form.register("email")}
          />
          <p className="text-xs text-destructive">{form.formState.errors.email?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-username">Username</Label>
          <Input id="user-username" placeholder="jane.doe" {...form.register("username")} />
          <p className="text-xs text-destructive">
            {form.formState.errors.username?.message}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-phone">Phone</Label>
          <Input id="user-phone" placeholder="+254700000000" {...form.register("phone")} />
          <p className="text-xs text-destructive">{form.formState.errors.phone?.message}</p>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="user-password">
            {isEdit ? "Password (optional)" : "Password"}
          </Label>
          <Input
            id="user-password"
            type="password"
            placeholder={isEdit ? "Leave blank to keep current password" : "Create a password"}
            {...form.register("password")}
          />
          <p className="text-xs text-destructive">
            {form.formState.errors.password?.message}
          </p>
        </div>
        <div className="space-y-3 md:col-span-2">
          <Label>Assigned branches</Label>
          <div className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-2">
            {options.branches.map((branch) => {
              const checked = selectedBranchIds.includes(branch.id);

              return (
                <label
                  key={branch.id}
                  className="flex items-start gap-3 rounded-xl border border-border/70 px-3 py-3"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-border"
                    checked={checked}
                    onChange={(event) => handleBranchToggle(branch.id, event.target.checked)}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{branch.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {branch.code}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Assign one branch for a branch-specific user, or multiple branches for a manager who needs to switch between them.
          </p>
          <p className="text-xs text-destructive">
            {form.formState.errors.branchIds?.message}
          </p>
        </div>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={isPending} onClick={handleCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : isEdit ? "Save changes" : "Save user"}
        </Button>
      </div>
    </form>
  );
}
