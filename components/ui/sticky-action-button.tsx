"use client"

import { Button } from "@/components/ui/button"

interface StickyActionButtonProps {
  onClick: () => void
  children: React.ReactNode
  variant?: "default" | "destructive"
  disabled?: boolean
}

export function StickyActionButton({
  onClick,
  children,
  variant = "default",
  disabled = false
}: StickyActionButtonProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
      <div className="container mx-auto max-w-3xl">
        <Button
          onClick={onClick}
          className="w-full py-8 text-lg shadow-lg"
          variant={variant}
          disabled={disabled}
        >
          {children}
        </Button>
      </div>
    </div>
  )
}
