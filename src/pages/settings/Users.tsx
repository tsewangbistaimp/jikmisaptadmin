import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, KeyRound, Ban, CheckCircle2, Trash2, ShieldCheck, RefreshCw, ScrollText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import { EmptyState, PageLoader } from "@/components/ui/misc";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { initials, getFunctionErrorMessage, formatDateTime } from "@/lib/utils";
import { staffFormSchema, type StaffFormValues } from "@/lib/schemas";
import type { Profile, AuditLog } from "@/lib/database.types";

export default function UsersSettings() {
  const { profile: currentUser } = useAuth();
  const [staff, setStaff] = React.useState<Profile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [resetting, setResetting] = React.useState<Profile | null>(null);
  const [statusTarget, setStatusTarget] = React.useState<Profile | null>(null);
  const [deleting, setDeleting] = React.useState<Profile | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setStaff((data as Profile[]) ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Settings & Staff</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage receptionist accounts. Only the Super Admin can access this page.</p>
      </div>

      <Card>
        <div className="flex items-center justify-between p-5 pb-0">
          <div>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Staff Accounts</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{staff.length} accounts</p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New Staff Account
          </Button>
        </div>

        <div className="mt-4">
          {loading ? (
            <PageLoader />
          ) : staff.length === 0 ? (
            <EmptyState title="No staff accounts" description="Create receptionist accounts to give your team access." />
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <THead>
                    <TR>
                      <TH>Name</TH>
                      <TH>Username</TH>
                      <TH>Role</TH>
                      <TH>Status</TH>
                      <TH className="text-right">Action</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {staff.map((s) => (
                      <TR key={s.id}>
                        <TD className="font-medium text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                              {initials(s.full_name)}
                            </div>
                            {s.full_name}
                            {s.id === currentUser?.id && <span className="text-xs text-slate-400 dark:text-slate-500">(you)</span>}
                          </div>
                        </TD>
                        <TD>{s.username}</TD>
                        <TD>
                          <Badge tone={s.role === "admin" ? "violet" : "slate"} className="capitalize">
                            {s.role}
                          </Badge>
                        </TD>
                        <TD>
                          <Badge tone={s.status === "active" ? "green" : "red"} className="capitalize">
                            {s.status}
                          </Badge>
                        </TD>
                        <TD>
                          <div className="flex justify-end gap-1">
                            <IconButton title="Reset password" onClick={() => setResetting(s)}>
                              <KeyRound className="h-4 w-4" />
                            </IconButton>
                            {s.id !== currentUser?.id && (
                              <>
                                <IconButton title={s.status === "active" ? "Disable" : "Enable"} onClick={() => setStatusTarget(s)}>
                                  {s.status === "active" ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                                </IconButton>
                                <IconButton title="Delete" destructive onClick={() => setDeleting(s)}>
                                  <Trash2 className="h-4 w-4" />
                                </IconButton>
                              </>
                            )}
                          </div>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
                {staff.map((s) => (
                  <div key={s.id} className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                        {initials(s.full_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                          {s.full_name}
                          {s.id === currentUser?.id && <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">(you)</span>}
                        </p>
                        <p className="truncate text-sm text-slate-500 dark:text-slate-400">{s.username}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge tone={s.role === "admin" ? "violet" : "slate"} className="capitalize">
                        {s.role}
                      </Badge>
                      <Badge tone={s.status === "active" ? "green" : "red"} className="capitalize">
                        {s.status}
                      </Badge>
                    </div>

                    <div className="mt-3 flex justify-end gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <IconButton title="Reset password" onClick={() => setResetting(s)}>
                        <KeyRound className="h-4 w-4" />
                      </IconButton>
                      {s.id !== currentUser?.id && (
                        <>
                          <IconButton title={s.status === "active" ? "Disable" : "Enable"} onClick={() => setStatusTarget(s)}>
                            {s.status === "active" ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          </IconButton>
                          <IconButton title="Delete" destructive onClick={() => setDeleting(s)}>
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Card>

      <AuthorizationCard staff={staff} />

      <CreateStaffDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
      <ResetPasswordDialog profile={resetting} onClose={() => setResetting(null)} />
      <ToggleStatusDialog profile={statusTarget} onClose={() => setStatusTarget(null)} onDone={load} />
      <DeleteStaffDialog profile={deleting} onClose={() => setDeleting(null)} onDone={load} />
    </div>
  );
}

function AuthorizationCard({ staff }: { staff: Profile[] }) {
  const nameById = React.useMemo(() => {
    const map = new Map<string, string>();
    staff.forEach((s) => map.set(s.id, s.full_name));
    return map;
  }, [staff]);

  const [code, setCode] = React.useState<string | null>(null);
  const [expiresAt, setExpiresAt] = React.useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  const [generating, setGenerating] = React.useState(false);
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [logsLoading, setLogsLoading] = React.useState(true);

  const loadLogs = React.useCallback(async () => {
    setLogsLoading(true);
    const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(15);
    setLogs((data as AuditLog[]) ?? []);
    setLogsLoading(false);
  }, []);

  React.useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  React.useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const generate = async () => {
    setGenerating(true);
    const { data, error } = await supabase.rpc("generate_auth_code");
    setGenerating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.code) {
      toast.error("Could not generate a code");
      return;
    }
    setCode(row.code);
    setExpiresAt(new Date(row.expires_at).getTime());
    toast.success("New authorization code generated");
    loadLogs();
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(1, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const expired = expiresAt !== null && secondsLeft <= 0;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            <ShieldCheck className="h-4.5 w-4.5 text-brand-500" /> Temporary Authorization
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Generate a short-lived code to let a receptionist delete a booking.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={generate} loading={generating}>
          <RefreshCw className="h-4 w-4" /> Generate Code
        </Button>
      </div>

      {code && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900">
          <div>
            <p className="text-2xl font-bold tracking-[0.3em] text-slate-900 dark:text-slate-100">{code}</p>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Share this with the receptionist. Single-use.</p>
          </div>
          <Badge tone={expired ? "red" : "green"}>{expired ? "Expired" : `${mm}:${ss}`}</Badge>
        </div>
      )}

      <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase text-slate-400 dark:text-slate-500">
          <ScrollText className="h-3.5 w-3.5" /> Recent Authorization Activity
        </p>
        {logsLoading ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">No authorized actions yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900">
                <div>
                  <p className="text-slate-700 dark:text-slate-300">
                    {l.action === "delete_booking" ? "Deleted booking" : l.action}
                    {typeof l.details?.booking_number === "string" ? ` ${String(l.details?.booking_number)}` : ""}
                    {" · by "}
                    {(l.performed_by && nameById.get(l.performed_by)) ?? "Unknown"}
                    {" · authorized by "}
                    {(l.admin_id && nameById.get(l.admin_id)) ?? "Unknown"}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{formatDateTime(l.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function IconButton({
  children,
  onClick,
  title,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  destructive?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      aria-label={title}
      className={`flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100 md:h-8 md:w-8 dark:hover:bg-slate-800 ${destructive ? "text-red-500 dark:text-red-400 hover:bg-red-50 dark:bg-red-500/10" : "text-slate-500 dark:text-slate-400"}`}
    >
      {children}
    </button>
  );
}

function CreateStaffDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: { role: "receptionist" },
  });

  React.useEffect(() => {
    if (open) reset({ full_name: "", username: "", email: "", phone: "", password: "", role: "receptionist" });
  }, [open, reset]);

  const onSubmit = async (values: StaffFormValues) => {
    const { data, error } = await supabase.functions.invoke("admin-create-user", { body: values });
    const fnError = (data as { error?: string } | null)?.error;
    if (error || fnError) {
      toast.error(fnError || (await getFunctionErrorMessage(error, "Could not create account")));
      return;
    }
    toast.success(`Account created for ${values.full_name}`);
    onCreated();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="New Staff Account" description="Only you can create staff accounts." className="max-w-sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label>Full Name</Label>
          <Input {...register("full_name")} error={errors.full_name?.message} />
          <FieldError message={errors.full_name?.message} />
        </div>
        <div>
          <Label>Username</Label>
          <Input {...register("username")} placeholder="reception01" error={errors.username?.message} />
          <FieldError message={errors.username?.message} />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" {...register("email")} error={errors.email?.message} />
          <FieldError message={errors.email?.message} />
        </div>
        <div>
          <Label>Phone Number</Label>
          <Input {...register("phone")} />
        </div>
        <div>
          <Label>Password</Label>
          <Input type="text" {...register("password")} placeholder="At least 8 characters" error={errors.password?.message} />
          <FieldError message={errors.password?.message} />
        </div>
        <div>
          <Label>Role</Label>
          <Select {...register("role")}>
            <option value="receptionist">Reception Staff</option>
            <option value="admin">Super Admin</option>
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Create Account
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ResetPasswordDialog({ profile, onClose }: { profile: Profile | null; onClose: () => void }) {
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (profile) {
      setPassword("");
      setError(null);
    }
  }, [profile]);

  if (!profile) return null;

  const submit = async () => {
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-manage-user", {
      body: { action: "reset_password", user_id: profile.id, password },
    });
    setLoading(false);
    const fnError = (data as { error?: string } | null)?.error;
    if (error || fnError) {
      setError(fnError || (await getFunctionErrorMessage(error, "Could not reset password")));
      return;
    }
    toast.success(`Password reset for ${profile.full_name}`);
    onClose();
  };

  return (
    <Dialog open={!!profile} onClose={onClose} title={`Reset Password — ${profile.full_name}`} className="max-w-sm">
      <div className="space-y-4">
        <div>
          <Label>New Password</Label>
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
          <FieldError message={error ?? undefined} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={loading}>
            Reset Password
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function ToggleStatusDialog({ profile, onClose, onDone }: { profile: Profile | null; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = React.useState(false);
  if (!profile) return null;
  const nextStatus = profile.status === "active" ? "disabled" : "active";

  const confirm = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-manage-user", {
      body: { action: "set_status", user_id: profile.id, status: nextStatus },
    });
    setLoading(false);
    const fnError = (data as { error?: string } | null)?.error;
    if (error || fnError) {
      toast.error(fnError || (await getFunctionErrorMessage(error, "Could not update status")));
      return;
    }
    toast.success(`${profile.full_name} ${nextStatus === "active" ? "enabled" : "disabled"}`);
    onDone();
    onClose();
  };

  return (
    <ConfirmDialog
      open={!!profile}
      onClose={onClose}
      onConfirm={confirm}
      title={`${nextStatus === "active" ? "Enable" : "Disable"} ${profile.full_name}?`}
      description={
        nextStatus === "disabled"
          ? "They will no longer be able to log in."
          : "They will regain access to the system."
      }
      confirmLabel={nextStatus === "active" ? "Enable" : "Disable"}
      destructive={nextStatus === "disabled"}
      loading={loading}
    />
  );
}

function DeleteStaffDialog({ profile, onClose, onDone }: { profile: Profile | null; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = React.useState(false);
  if (!profile) return null;

  const confirm = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-manage-user", {
      body: { action: "delete", user_id: profile.id },
    });
    setLoading(false);
    const fnError = (data as { error?: string } | null)?.error;
    if (error || fnError) {
      toast.error(fnError || (await getFunctionErrorMessage(error, "Could not delete account")));
      return;
    }
    toast.success(`${profile.full_name} removed`);
    onDone();
    onClose();
  };

  return (
    <ConfirmDialog
      open={!!profile}
      onClose={onClose}
      onConfirm={confirm}
      title={`Delete ${profile.full_name}?`}
      description="This permanently removes their login. This cannot be undone."
      confirmLabel="Delete"
      destructive
      loading={loading}
    />
  );
}
