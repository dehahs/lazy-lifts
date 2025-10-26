"use client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/auth-context"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function UserNav() {
  const { user, signInWithGoogle, signOut } = useAuth()
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-4">
      <div className="flex gap-2">
        <Link href="/about">
          <Button variant="ghost" className="text-base font-medium">
            What is this?
          </Button>
        </Link>
        <Link href="/stats">
          <Button variant="ghost" className="text-base font-medium">
            Stats
          </Button>
        </Link>
        <Link href="/calories">
          <Button variant="ghost" className="text-base font-medium">
            Calories
          </Button>
        </Link>
      </div>
      
      {!user ? (
        <Button onClick={() => signInWithGoogle()} variant="outline">
          Sign in
        </Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "User avatar"} />
                <AvatarFallback>{user.displayName?.[0] || "U"}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel className="text-base">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="text-base">
              <Link href="/profile" className="cursor-pointer">
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer text-base">
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

