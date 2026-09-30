import { usePageTitle } from "@/hooks/usePageTitle"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Home } from "lucide-react"

export default function NotFound() {
  usePageTitle("Page Not Found")
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="rounded-xl bg-primary/10 p-4 mb-6">
        <div className="text-6xl font-bold text-primary/30">404</div>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
        Page not found
      </h1>
      <p className="text-sm text-muted-foreground mb-8 max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
        <Button onClick={() => navigate("/production-management")}>
          <Home className="mr-2 h-4 w-4" />
          Production Management
        </Button>
      </div>
    </div>
  )
}
