import { useCallback, useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { FilterField } from "@/components/ui/FilterField";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Users,
  CircleDot,
  Shield,
} from "lucide-react";
import {
  addUser,
  checkUserCode,
  deleteUser,
  fetchUsersMaster,
  updateUser,
} from "../api";
import type {
  AddUserPayload,
  UpdateUserPayload,
  UserMasterFilter,
  UserMasterRow,
} from "../types";
import {
  isActiveStatus,
  ACTIVE_STATUS_BADGE,
  DEFAULT_STATUS_BADGE,
} from "@/lib/status";

const PAGE_SIZE = 10;

const ROLE_OPTIONS = [
  { value: "U", label: "User" },
  { value: "A", label: "Admin" },
  { value: "SA", label: "Super Admin" },
];

const STATUS_OPTIONS = [
  { value: "A", label: "Active" },
  { value: "I", label: "Inactive" },
];

interface FormState {
  usercode: string;
  password: string;
  fname: string;
  mi: string;
  lname: string;
  email: string;
  position: string;
  costcenter: string;
  usernumber: string;
  role: string;
  status: string;
}

const EMPTY_FORM: FormState = {
  usercode: "",
  password: "",
  fname: "",
  mi: "",
  lname: "",
  email: "",
  position: "",
  costcenter: "",
  usernumber: "",
  role: "U",
  status: "A",
};

function toForm(r: UserMasterRow): FormState {
  return {
    usercode: r.usercode,
    password: "",
    fname: r.fname ?? "",
    mi: r.mi ?? "",
    lname: r.lname ?? "",
    email: r.email ?? "",
    position: r.position ?? "",
    costcenter: r.costcenter ?? "",
    usernumber: r.usernumber ?? "",
    role: r.usermnt ? "SA" : r.usersupv ? "A" : "U",
    status: r.status ?? "A",
  };
}

function roleLabel(r: UserMasterRow): string {
  if (r.usermnt) return "Super Admin";
  if (r.usersupv) return "Admin";
  return "User";
}

export default function UserMasterPage() {
  usePageTitle("User Master");

  const { user } = useAuth();
  const userlogin = user?.userCode ?? "";

  const [rows, setRows] = useState<UserMasterRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: "", status: "" });

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editId, setEditId] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (pageNo: number, f: typeof filters) => {
    setLoading(true);
    try {
      const filter: UserMasterFilter = {
        size: PAGE_SIZE,
        pageno: pageNo,
        ...f,
      };
      const result = await fetchUsersMaster(filter);
      setRows(result.rows);
      setTotal(result.totalItems);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page, filters);
  }, [page, load]);

  const handleSearch = () => {
    setPage(1);
    load(1, filters);
  };

  const resetSearch = () => {
    setFilters({ search: "", status: "" });
    setPage(1);
    load(1, { search: "", status: "" });
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setError("");
    setAddOpen(true);
  };

  const openEdit = (row: UserMasterRow) => {
    setEditId(row.usercode);
    setForm(toForm(row));
    setError("");
    setEditOpen(true);
  };

  const openDelete = (row: UserMasterRow) => {
    setDeleteId(row.usercode);
    setError("");
    setDeleteOpen(true);
  };

  const set =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleAdd = async () => {
    if (!form.usercode.trim()) {
      setError("User Code is required");
      return;
    }
    if (!form.password) {
      setError("Password is required");
      return;
    }
    if (!form.fname.trim() || !form.lname.trim()) {
      setError("First Name and Last Name are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const exists = await checkUserCode(form.usercode.trim());
      if (exists.exists) {
        setError(`User "${form.usercode.trim()}" already exists`);
        return;
      }
      const payload: AddUserPayload = {
        usercode: form.usercode.trim(),
        fname: form.fname,
        mi: form.mi,
        lname: form.lname,
        email: form.email,
        position: form.position,
        costcenter: form.costcenter,
        usernumber: form.usernumber,
        password: form.password,
        role: form.role,
        status: form.status,
        userlogin,
      };
      const res = await addUser(payload);
      if (res.status === "blocked") {
        setError(res.message || `User "${form.usercode}" already exists`);
        return;
      }
      if (res.status === "error") {
        setError("Failed to add user");
        return;
      }
      setAddOpen(false);
      setMessage(`User "${form.usercode}" added`);
      setTimeout(() => setMessage(""), 3000);
      load(page, filters);
    } catch {
      setError("Failed to add user");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    setSaving(true);
    setError("");
    try {
      const payload: UpdateUserPayload = {
        usercode: editId,
        fname: form.fname,
        mi: form.mi,
        lname: form.lname,
        email: form.email,
        position: form.position,
        costcenter: form.costcenter,
        usernumber: form.usernumber,
        role: form.role,
        status: form.status,
        password: form.password || undefined,
        userlogin,
      };
      await updateUser(payload);
      setEditOpen(false);
      setMessage(`User "${editId}" updated`);
      setTimeout(() => setMessage(""), 3000);
      load(page, filters);
    } catch {
      setError("Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await deleteUser(deleteId, userlogin);
      if (res.status === "blocked") {
        setError(
          res.message ||
            `User "${deleteId}" cannot be deleted because it is referenced by other records.`,
        );
        return;
      }
      if (res.status === "error") {
        setError("Failed to delete user");
        return;
      }
      setDeleteOpen(false);
      setMessage(`User "${deleteId}" deleted`);
      setTimeout(() => setMessage(""), 3000);
      load(page, filters);
    } catch {
      setError("Failed to delete user");
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 animate-in">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#005B96] to-[#0078C8] px-7 py-6 text-white shadow-md border border-white/10">
        <div className="absolute inset-0 opacity-[0.04]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="user-master-grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#user-master-grid)" />
            <line
              x1="0"
              y1="0"
              x2="100%"
              y2="100%"
              stroke="white"
              strokeWidth="0.3"
            />
            <line
              x1="100%"
              y1="0"
              x2="0"
              y2="100%"
              stroke="white"
              strokeWidth="0.3"
            />
          </svg>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-5">
          <div className="flex-shrink-0">
            <div className="flex h-20 w-28 items-center justify-center overflow-hidden rounded-xl bg-white/15 backdrop-blur-sm border border-white/10 shadow-inner">
              <img
                src="/plan.png"
                alt="Production Planning"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-bold tracking-tight text-white leading-tight">
              User Master
            </div>
            <div className="text-sm font-medium text-white/70 mt-0.5">
              Manage user records
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <Users className="h-3 w-3" />
                {total} User{total !== 1 ? "s" : ""}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <Search className="h-3 w-3" />
                Status: Active / Inactive
              </div>
              {message && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white border border-white/10">
                  {message}
                </div>
              )}
            </div>
          </div>
          <div className="flex-shrink-0">
            <div className="flex items-center justify-center rounded-xl bg-white/95 backdrop-blur-sm px-4 py-2.5 shadow-sm border border-white/20">
              <img
                src="/logo_npax.png"
                alt="ISUZU"
                className="h-8 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[160px]">
              <FilterField icon={Search}>
                <Input
                  placeholder="User Code / Name / Email"
                  value={filters.search}
                  autoComplete="off"
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, search: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </FilterField>
            </div>
            <div className="flex-1 min-w-[160px]">
              <FilterField icon={CircleDot}>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={filters.status}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, status: e.target.value }))
                  }
                >
                  <option value="">Status (All)</option>
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </FilterField>
            </div>
            <Button variant="default" size="sm" onClick={handleSearch}>
              <Search className="mr-1.5 h-4 w-4" />
              Search
            </Button>
            <Button variant="outline" size="sm" onClick={resetSearch}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Users</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {total} user{total !== 1 ? "s" : ""}
            </span>
            <Button size="sm" onClick={openAdd}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add New User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No users found
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Nothing to display, please add your user now.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100 dark:bg-slate-800 border-b border-border/60">
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      User Code
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Name
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Email
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Position
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Role
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Status
                    </th>
                    <th className="text-right font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.usercode}
                      className="border-b border-border/20 transition-colors hover:bg-[#005B96]/[0.04]"
                    >
                      <td className="py-2.5 px-3 font-medium">{r.usercode}</td>
                      <td className="py-2.5 px-3">{r.name}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {r.email}
                      </td>
                      <td className="py-2.5 px-3">{r.position}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {roleLabel(r)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            isActiveStatus(r.status)
                              ? ACTIVE_STATUS_BADGE
                              : DEFAULT_STATUS_BADGE
                          }`}
                        >
                          {isActiveStatus(r.status) ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(r)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => openDelete(r)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 0 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
        </CardContent>
      </Card>
      <Dialog
        open={addOpen || editOpen}
        onOpenChange={(o) => {
          if (!o) {
            setAddOpen(false);
            setEditOpen(false);
          }
        }}
      >
        <DialogContent
          hideDefaultClose
          className="max-w-lg w-full max-h-[78vh] overflow-hidden flex flex-col p-0 gap-0"
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
            <DialogTitle>
              {editOpen ? `Update User (${editId})` : "Add New User"}
            </DialogTitle>
            <DialogDescription>
              {editOpen
                ? "Edit the user details below. Leave the password blank to keep the current one."
                : "Fill in the user details below. The User Code is required and must be unique."}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mx-6 mt-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6 product-master-scroll">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="usercode">User Code</Label>
                <Input
                  id="usercode"
                  maxLength={15}
                  value={form.usercode}
                  onChange={set("usercode")}
                  disabled={editOpen}
                  placeholder={editOpen ? editId : "e.g. 20234"}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">
                  {editOpen ? "New Password" : "Password"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={set("password")}
                  placeholder={editOpen ? "Leave blank to keep" : "Required"}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fname">First Name</Label>
                <Input
                  id="fname"
                  maxLength={30}
                  value={form.fname}
                  onChange={set("fname")}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mi">Middle Initial</Label>
                <Input
                  id="mi"
                  maxLength={30}
                  value={form.mi}
                  onChange={set("mi")}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lname">Last Name</Label>
                <Input
                  id="lname"
                  maxLength={30}
                  value={form.lname}
                  onChange={set("lname")}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  maxLength={50}
                  value={form.position}
                  onChange={set("position")}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  maxLength={40}
                  value={form.email}
                  onChange={set("email")}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="costcenter">Cost Center</Label>
                <Input
                  id="costcenter"
                  maxLength={12}
                  value={form.costcenter}
                  onChange={set("costcenter")}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="usernumber">Employee No.</Label>
                <Input
                  id="usernumber"
                  maxLength={6}
                  value={form.usernumber}
                  onChange={set("usernumber")}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role">Role</Label>
                <FilterField icon={Shield}>
                  <select
                    id="role"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.role}
                    onChange={set("role")}
                  >
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <FilterField icon={CircleDot}>
                  <select
                    id="status"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.status}
                    onChange={set("status")}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border/60 bg-background">
            <Button
              variant="outline"
              onClick={() => {
                setAddOpen(false);
                setEditOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editOpen ? handleUpdate : handleAdd}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {editOpen ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => !o && setDeleteOpen(false)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete user "{deleteId}"? This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        .product-master-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .product-master-scroll::-webkit-scrollbar-track {
          background: transparent;
          margin: 4px 0;
        }
        .product-master-scroll::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.4);
          border-radius: 999px;
        }
        .product-master-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.6);
        }
      `}</style>
    </div>
  );
}
