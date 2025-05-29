"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    onPointerDown={(e) => {
      // Check if keyboard is open and prevent modal close
      const keyboardOpen = document.querySelector('#KioskBoard-VirtualKeyboard');
      const hasKeyboardOpenClass = document.body.classList.contains('kioskboard-open');
      
      if (keyboardOpen || hasKeyboardOpenClass) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Prevented modal close due to virtual keyboard being open');
        return;
      }
      
      // Allow normal behavior if keyboard is not open
      props.onPointerDown?.(e);
    }}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const [isKeyboardOpen, setIsKeyboardOpen] = React.useState(false);

  React.useEffect(() => {
    const checkKeyboardState = () => {
      const keyboardVisible = document.querySelector('#KioskBoard-VirtualKeyboard');
      const hasKeyboardClass = document.body.classList.contains('kioskboard-open');
      setIsKeyboardOpen(!!(keyboardVisible || hasKeyboardClass));
    };

    // Check initial state
    checkKeyboardState();

    // Set up mutation observer to watch for keyboard changes
    const observer = new MutationObserver(() => {
      checkKeyboardState();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });

    // Also listen for custom events
    const handleKeyboardOpen = () => setIsKeyboardOpen(true);
    const handleKeyboardClose = () => setIsKeyboardOpen(false);

    document.addEventListener('kioskboard-opened', handleKeyboardOpen);
    document.addEventListener('kioskboard-closed', handleKeyboardClose);

    return () => {
      observer.disconnect();
      document.removeEventListener('kioskboard-opened', handleKeyboardOpen);
      document.removeEventListener('kioskboard-closed', handleKeyboardClose);
    };
  }, []);

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          // Adjust positioning when keyboard is open
          isKeyboardOpen 
            ? "top-[25%] translate-x-[-50%] translate-y-[-50%] max-h-[50vh] overflow-y-auto" 
            : "top-[50%] translate-x-[-50%] translate-y-[-50%]",
          className
        )}
        onPointerDownOutside={(e) => {
          // Prevent modal close when clicking outside if keyboard is open
          const keyboardOpen = document.querySelector('#KioskBoard-VirtualKeyboard');
          const hasKeyboardOpenClass = document.body.classList.contains('kioskboard-open');
          
          if (keyboardOpen || hasKeyboardOpenClass) {
            e.preventDefault();
            console.log('Prevented modal close from outside click due to virtual keyboard');
            return;
          }
          
          // Allow normal behavior if keyboard is not open
          props.onPointerDownOutside?.(e);
        }}
        onEscapeKeyDown={(e) => {
          // If keyboard is open, let the keyboard handle escape instead of closing modal
          const keyboardOpen = document.querySelector('#KioskBoard-VirtualKeyboard');
          const hasKeyboardOpenClass = document.body.classList.contains('kioskboard-open');
          
          if (keyboardOpen || hasKeyboardOpenClass) {
            e.preventDefault();
            console.log('Prevented modal close from escape key due to virtual keyboard');
            return;
          }
          
          // Allow normal behavior if keyboard is not open
          props.onEscapeKeyDown?.(e);
        }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
