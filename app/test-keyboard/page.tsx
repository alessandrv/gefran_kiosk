"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ValidatedInput } from "@/components/ui/validated-input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { CheckCircle, AlertCircle } from "lucide-react"

export default function TestKeyboardPage() {
  const [formData, setFormData] = useState({
    ipAddress: "",
    dnsServer: "",
    hostname: "",
    port: "",
  })

  const [showResults, setShowResults] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setShowResults(true)
  }

  const handleReset = () => {
    setFormData({
      ipAddress: "",
      dnsServer: "",
      hostname: "",
      port: "",
    })
    setShowResults(false)
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-blue-600">
              Input Validation & On-Screen Keyboard Demo
            </CardTitle>
            <p className="text-gray-600">
              Test the enhanced input validation and touch-friendly keyboard features
            </p>
          </CardHeader>
          <CardContent>
            <Alert className="mb-6">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Features being demonstrated:</strong>
                <ul className="list-disc ml-4 mt-2 space-y-1">
                  <li>Full keyboard layout with all letters, numbers, and symbols</li>
                  <li>CAPS LOCK and SHIFT functionality for uppercase and symbols</li>
                  <li>Improved focus management (keyboard won't close when clicking keys)</li>
                  <li>Touch debouncing prevents double character input</li>
                  <li>Works properly inside dialogs and modals</li>
                  <li>IP address validation (prevents commas, validates format)</li>
                  <li>DNS server validation (accepts IPs or domain names)</li>
                  <li>Touch-friendly interface with larger keys</li>
                  <li>Real-time validation feedback</li>
                </ul>
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="ip">IP Address</Label>
                  <ValidatedInput
                    id="ip"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData(prev => ({ ...prev, ipAddress: e.target.value }))}
                    placeholder="192.168.1.100"
                    validationType="ip"
                    enableKeyboard={true}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Try typing a comma - it will be prevented with an error message
                  </p>
                </div>

                <div>
                  <Label htmlFor="dns">DNS Server</Label>
                  <ValidatedInput
                    id="dns"
                    value={formData.dnsServer}
                    onChange={(e) => setFormData(prev => ({ ...prev, dnsServer: e.target.value }))}
                    placeholder="8.8.8.8 or dns.google.com"
                    validationType="dns"
                    enableKeyboard={true}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Accepts both IP addresses and domain names
                  </p>
                </div>

                <div>
                  <Label htmlFor="hostname">Hostname</Label>
                  <ValidatedInput
                    id="hostname"
                    value={formData.hostname}
                    onChange={(e) => setFormData(prev => ({ ...prev, hostname: e.target.value }))}
                    placeholder="server.example.com"
                    validationType="text"
                    enableKeyboard={true}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Full keyboard layout with letters and numbers
                  </p>
                </div>

                <div>
                  <Label htmlFor="port">Port Number</Label>
                  <ValidatedInput
                    id="port"
                    value={formData.port}
                    onChange={(e) => setFormData(prev => ({ ...prev, port: e.target.value }))}
                    placeholder="80"
                    validationType="number"
                    enableKeyboard={true}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Numeric keypad layout only
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Test Validation
                </Button>
                <Button type="button" variant="outline" onClick={handleReset}>
                  Reset Form
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">Test in Dialog</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Keyboard Test in Dialog</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="dialog-ip">IP Address in Dialog</Label>
                        <ValidatedInput
                          id="dialog-ip"
                          placeholder="192.168.1.1"
                          validationType="ip"
                          enableKeyboard={true}
                          value=""
                          onChange={() => {}}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          The keyboard should appear at the bottom of the screen, not inside this dialog
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="dialog-text">Text Field in Dialog</Label>
                        <ValidatedInput
                          id="dialog-text"
                          placeholder="Type something..."
                          validationType="text"
                          enableKeyboard={true}
                          value=""
                          onChange={() => {}}
                        />
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </form>

            {showResults && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-medium text-green-800 mb-3">Form Values Captured:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">IP Address:</span> {formData.ipAddress || "Not set"}
                  </div>
                  <div>
                    <span className="font-medium">DNS Server:</span> {formData.dnsServer || "Not set"}
                  </div>
                  <div>
                    <span className="font-medium">Hostname:</span> {formData.hostname || "Not set"}
                  </div>
                  <div>
                    <span className="font-medium">Port:</span> {formData.port || "Not set"}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">Validation Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">IP Address Validation</h4>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>• Must be valid IPv4 format (0-255.0-255.0-255.0-255)</li>
                  <li>• Commas are blocked and show error message</li>
                  <li>• Real-time validation with visual feedback</li>
                  <li>• On-screen keyboard shows numbers and dots only</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-3">DNS Server Validation</h4>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>• Accepts valid IP addresses</li>
                  <li>• Accepts valid domain names</li>
                  <li>• Commas are blocked (use separate fields)</li>
                  <li>• Specialized keyboard layout for IP/domain entry</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">Keyboard Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">⌨️</span>
                </div>
                <h4 className="font-medium">Full QWERTY Layout</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Complete keyboard with all letters (a-z), numbers (0-9), and special characters
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🔄</span>
                </div>
                <h4 className="font-medium">CAPS & SHIFT</h4>
                <p className="text-sm text-gray-600 mt-1">
                  CAPS LOCK for permanent uppercase, SHIFT for temporary uppercase and symbols (!@#$%)
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🎯</span>
                </div>
                <h4 className="font-medium">Smart Positioning</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Keyboard appears at screen bottom even when used inside dialogs, with smart focus management
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">📱</span>
                </div>
                <h4 className="font-medium">Touch Optimized</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Larger keys (48px), better spacing, and touch event handling for mobile devices
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 