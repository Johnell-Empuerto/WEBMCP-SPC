import { useState, useEffect, useCallback } from "react"
import { usePageTitle } from "@/hooks/usePageTitle"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Pagination } from "@/components/ui/Pagination"
import { FilterField } from "@/components/ui/FilterField"
import { Search, Plus, Pencil, Trash2 } from "lucide-react"
import { getRoleLabel } from "@/auth/permissions"
import { fetchUsers } from "@/features/users/api"
import type { UserItem } from "@/features/users/types"
import { getStatusLabel, isActiveStatus, ACTIVE_STATUS_BADGE, DEFAULT_STATUS_BADGE } from "@/lib/status"

export default function UsersPage() {
  usePageTitle("Users")

  const [users, setUsers] = useState<UserItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")

  const loadUsers = useCallback(async (pageNo: number, searchTerm: string) => {
    setLoading(true)
    try {
      const result = await fetchUsers(pageNo, 50, searchTerm)
      setUsers(result.items)
      setTotal(result.total)
    } catch {
      setUsers([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers(page, search)
  }, [page, loadUsers])

  const handleSearch = () => {
    setPage(1)
    loadUsers(1, search)
  }

  const totalPages = Math.ceil(total / 50)

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage system users and their roles</p>
        </div>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Create User
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <FilterField icon={Search}>
                <Input
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </FilterField>
            </div>
            <Button variant="default" size="sm" onClick={handleSearch}>
              <Search className="mr-1.5 h-4 w-4" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Users</CardTitle>
          <span className="text-xs text-muted-foreground">{total} user{total !== 1 ? "s" : ""}</span>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No users found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Create a new user to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100 dark:bg-slate-800 border-b border-border/60">
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">User Code</th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">Name</th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">Email</th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">Role</th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">Status</th>
                    <th className="text-right font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.userCode} className="border-b border-border/20 transition-colors hover:bg-[#005B96]/[0.04]">
                      <td className="py-2.5 px-3 font-medium">{user.userCode}</td>
                      <td className="py-2.5 px-3">{user.userName}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{user.email}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {getRoleLabel(user.roleId)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          isActiveStatus(user.status) || user.status?.trim().toLowerCase() === "active"
                            ? ACTIVE_STATUS_BADGE
                            : DEFAULT_STATUS_BADGE
                        }`}>
                          {getStatusLabel(user.status)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
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
              pageSize={50}
              onPageChange={setPage}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
