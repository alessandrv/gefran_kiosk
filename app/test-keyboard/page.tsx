"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useKioskBoard } from "@/hooks/useKioskBoard"

export default function TestKeyboardPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [alertOpen, setAlertOpen] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [alertInputValue, setAlertInputValue] = useState("")

  // Initialize virtual keyboard
  useKioskBoard({
    theme: 'light',
    language: 'en',
    allowRealKeyboard: true,
    allowMobileKeyboard: false,
    autoScroll: false,
    keysFontSize: '18px',
    keysIconSize: '20px'
  })

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Virtual Keyboard Modal Test</h1>
        
        <div className="space-y-6">
          {/* Regular input outside modal */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Regular Input (Outside Modal)</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="regular-input">Test Input</Label>
                <Input
                  id="regular-input"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Click to open virtual keyboard"
                  className="kioskboard-input"
                />
              </div>
              <p className="text-sm text-gray-600">
                Current value: {inputValue || "Empty"}
              </p>
            </div>
          </div>

          {/* Dialog Modal Test */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Dialog Modal Test</h2>
            <p className="text-sm text-gray-600 mb-4">
              Test that clicking on the virtual keyboard doesn't close the modal and that the modal moves up when keyboard opens.
            </p>
            
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>Open Dialog with Input</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Test Dialog</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="dialog-input">Input in Dialog</Label>
                    <Input
                      id="dialog-input"
                      placeholder="Type here - keyboard should not close modal"
                      className="kioskboard-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dialog-input2">Second Input</Label>
                    <Input
                      id="dialog-input2"
                      placeholder="Another input field"
                      className="kioskboard-input"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={() => setDialogOpen(false)}>
                      Save
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Alert Dialog Test */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Alert Dialog Test</h2>
            <p className="text-sm text-gray-600 mb-4">
              Test that alert dialogs also work correctly with the virtual keyboard.
            </p>
            
            <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Open Alert with Input</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Action</AlertDialogTitle>
                  <AlertDialogDescription>
                    Please enter a confirmation value below. The keyboard should not close this dialog.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="my-4">
                  <Label htmlFor="alert-input">Confirmation Input</Label>
                  <Input
                    id="alert-input"
                    value={alertInputValue}
                    onChange={(e) => setAlertInputValue(e.target.value)}
                    placeholder="Type 'CONFIRM' to proceed"
                    className="kioskboard-input"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setAlertOpen(false)}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => setAlertOpen(false)}
                    disabled={alertInputValue !== 'CONFIRM'}
                  >
                    Confirm
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4 text-blue-800">Test Instructions</h2>
            <ul className="space-y-2 text-sm text-blue-700">
              <li>• Click on any input field to open the virtual keyboard</li>
              <li>• When keyboard opens in a modal, the modal should move up to stay visible</li>
              <li>• Clicking on virtual keyboard keys should NOT close the modal</li>
              <li>• Clicking outside the modal (but not on keyboard) should still close it when keyboard is closed</li>
              <li>• Pressing Escape when keyboard is open should close keyboard, not modal</li>
              <li>• Pressing Escape when keyboard is closed should close modal normally</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
} 