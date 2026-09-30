import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "@/auth/AuthProvider"
import { canManageUsers } from "@/auth/permissions"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import LoginPage from "@/components/login/LoginPage"
import AppShell from "@/components/layout/AppShell"
import ProductionCharts from "@/features/production-charts/components/ProductionChartsPage"
import UsersPage from "@/features/users/components/UsersPage"
import NotFound from "@/pages/NotFound"
import SettingsPage from "@/features/settings/components/SettingsPage"
import ProductionManagementPage from "@/features/production-management/components/ProductionManagementPage"
import PlanUploaderPage from "@/features/plan-uploader/components/PlanUploaderPage"
import DprAdcPage from "@/features/dpr-adc/components/DprAdcPage"
import DprC4Page from "@/features/dpr-c4/components/DprC4Page"
import DprKdPage from "@/features/dpr-kd/components/DprKdPage"
import MprAdcPage from "@/features/mpr-adc/components/MprAdcPage"
import MprC4Page from "@/features/mpr-c4/components/MprC4Page"
import MprKdPage from "@/features/mpr-kd/components/MprKdPage"
import PalletEntryPage from "@/features/pallet-entry/components/PalletEntryPage"
import ProductMasterPage from "@/features/product-master/components/ProductMasterPage"
import KanbanMasterPage from "@/features/kanban-master/components/KanbanMasterPage"
import PalletMasterPage from "@/features/pallet-master/components/PalletMasterPage"
import LocatorMasterPage from "@/features/locator-master/components/LocatorMasterPage"
import UserMasterPage from "@/features/user-master/components/UserMasterPage"
import PreferenceMasterPage from "@/features/preference-master/components/PreferenceMasterPage"
import ShiftMasterPage from "@/features/shift-master/components/ShiftMasterPage"
import NgMasterPage from "@/features/ng-master/components/NgMasterPage"
import NgTaggingPage from "@/features/ng-tagging/components/NgTaggingPage"
import NgReportPage from "@/features/ng-report/components/NgReportPage"
import DprMasterPage from "@/features/dpr-master/components/DprMasterPage"
import LogsPage from "@/features/logs/components/LogsPage"
import type { ReactNode } from "react"

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="space-y-4 w-80">
        <Skeleton className="h-10 w-24 mx-auto rounded-lg" />
        <Skeleton className="h-4 w-48 mx-auto" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return <>{children}</>
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (isAuthenticated) return <Navigate to="/" replace />

  return <>{children}</>
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!canManageUsers(user?.roleId ?? -1)) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-lg font-semibold">Access Denied</p>
            <p className="text-sm text-muted-foreground text-center">
              You do not have permission to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/production-management" replace />} />
        <Route path="/production-management" element={<ProductionManagementPage />} />
        <Route path="/plan-uploader" element={<PlanUploaderPage />} />
        <Route path="/dpr-adc" element={<DprAdcPage />} />
        <Route path="/dpr-c4" element={<DprC4Page />} />
        <Route path="/dpr-kd" element={<DprKdPage />} />
        <Route path="/mpr-adc" element={<MprAdcPage />} />
        <Route path="/mpr-c4" element={<MprC4Page />} />
        <Route path="/mpr-kd" element={<MprKdPage />} />
        <Route path="/pallet-entry" element={<PalletEntryPage />} />
        <Route path="/product-master" element={<ProductMasterPage />} />
        <Route path="/kanban-master" element={<KanbanMasterPage />} />
        <Route path="/pallet-master" element={<PalletMasterPage />} />
        <Route path="/locator-master" element={<LocatorMasterPage />} />
        <Route path="/user-master" element={<UserMasterPage />} />
        <Route path="/preference-master" element={<PreferenceMasterPage />} />
        <Route path="/shift-master" element={<ShiftMasterPage />} />
        <Route path="/ng-master" element={<NgMasterPage />} />
        <Route path="/ng-tagging" element={<NgTaggingPage />} />
        <Route path="/ng-report" element={<NgReportPage />} />
        <Route path="/dpr-master" element={<DprMasterPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/analysis/production" element={<ProductionCharts />} />
        <Route
          path="/users"
          element={
            <AdminRoute>
              <UsersPage />
            </AdminRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <AdminRoute>
              <SettingsPage />
            </AdminRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
