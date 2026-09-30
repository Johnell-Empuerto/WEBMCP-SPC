import { useAuth } from "@/auth/AuthProvider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, Menu } from "lucide-react"

interface HeaderProps {
  onMenuClick?: () => void
  onToggleCollapse?: () => void
}

export default function Header({ onMenuClick, onToggleCollapse }: HeaderProps) {
  const { user, logout } = useAuth()

  const initials = user?.userName
    ? user.userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??"

  return (
    <header className="flex h-14 items-center gap-3 bg-primary px-4 sm:px-6 shrink-0 shadow-sm">
      <Button
        variant="ghost"
        size="icon"
        className="-ml-1.5 text-white/60 hover:text-white hover:bg-white/10 active:bg-white/15"
        onClick={() => {
          if (window.innerWidth < 1024) onMenuClick?.()
          else onToggleCollapse?.()
        }}
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </Button>

      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 h-8 px-2 rounded-full hover:bg-white/10">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-white/20 text-white text-[10px] font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            {user && (
              <span className="text-sm font-medium text-white/90 truncate max-w-[160px]">
                {user.userName}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col space-y-0.5">
              <p className="text-sm font-medium leading-none text-foreground">{user?.userName}</p>
              <p className="text-xs text-muted-foreground">{user?.userCode}</p>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={logout}
            className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
