"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/components/ui/use-toast"
import {
  MonitorSpeaker,
  Edit,
  X,
  RefreshCw,
} from "lucide-react"
import toast from 'react-hot-toast'

interface X11VNCSettingsProps {
  x11vncSettings: any
  isApiConnected: boolean
  isLoading: boolean
  onConfigureX11VNC: (config: any) => Promise<void>
}

export default function X11VNCSettings({
  x11vncSettings,
  isApiConnected,
  isLoading,
  onConfigureX11VNC,
}: X11VNCSettingsProps) {
  const [x11vncFormData, setX11VNCFormData] = useState({
    enabled: false,
    port: 5900,
    password: '',
    autostart: false
  })
  
  const [passwordPopoverOpen, setPasswordPopoverOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordChanged, setPasswordChanged] = useState(false)
  const [isConfiguringX11VNC, setIsConfiguringX11VNC] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (x11vncSettings) {
      setX11VNCFormData({
        enabled: x11vncSettings.enabled || false,
        port: x11vncSettings.port || 5900,
        password: '',
        autostart: x11vncSettings.autostart || false
      })
      setPasswordChanged(false)
    }
  }, [x11vncSettings])

  const handleConfigureX11VNC = async () => {
    if (x11vncFormData.enabled && !x11vncSettings?.hasPassword && !passwordChanged) {
              toast({
          variant: "destructive",
          title: "Password Required",
          description: "Password is required to enable VNC server for security.",
        })
      return
    }

    setIsConfiguringX11VNC(true)
    try {
      const configToSend = {
        ...x11vncFormData,
        ...(passwordChanged ? { password: x11vncFormData.password } : {})
      }
      await onConfigureX11VNC(configToSend)
      toast({
        title: "X11VNC Configuration",
        description: x11vncFormData.enabled ? "X11VNC server configured successfully!" : "X11VNC server disabled successfully!",
      })
      setPasswordChanged(false)
    } catch (error: any) {
      console.error('Failed to configure X11VNC:', error)
              toast({
          variant: "destructive",
          title: "Configuration Failed",
          description: `Failed to configure X11VNC: ${error.message || error}`,
        })
    } finally {
      setIsConfiguringX11VNC(false)
    }
  }

  const handlePasswordChange = () => {
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters')
      return
    }
    
    setX11VNCFormData(prev => ({ ...prev, password: newPassword }))
    setPasswordChanged(true)
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
    setPasswordPopoverOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-blue-600 flex items-center gap-2">
            <MonitorSpeaker className="w-5 h-5" />
            VNC Server Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${x11vncSettings?.installed ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="font-medium">Installation</span>
              </div>
              <span className="text-sm text-gray-600">
                {x11vncSettings?.installed ? 'X11VNC is installed' : 'X11VNC not installed'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${x11vncSettings?.enabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="font-medium">Service</span>
              </div>
              <span className="text-sm text-gray-600">
                {x11vncSettings?.enabled ? 'Running' : 'Stopped'}
              </span>
            </div>
          </div>
          
          {x11vncSettings?.enabled && (
            <div className="pt-2 border-t">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Port:</span> {x11vncSettings.port}
                </div>
                <div>
                  <span className="font-medium">Password:</span> {x11vncSettings.hasPassword ? 'Set' : 'None'}
                </div>
                <div>
                  <span className="font-medium">Remote Access:</span> Always Allowed
                </div>
                <div>
                  <span className="font-medium">Autostart:</span> {x11vncSettings.autostart ? 'Enabled' : 'Disabled'}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Card */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-blue-600">VNC Configuration</CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Configure X11VNC server settings. Requires X11VNC to be installed.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="vncEnabled"
              checked={x11vncFormData.enabled}
              onChange={(e) => setX11VNCFormData(prev => ({ ...prev, enabled: e.target.checked }))}
              className="rounded"
            />
            <Label htmlFor="vncEnabled">Enable X11VNC Server</Label>
          </div>

          {x11vncFormData.enabled && (
            <div className="space-y-4 pt-4 border-t">
              <div>
                <Label htmlFor="vncPort">VNC Port</Label>
                <Input
                  id="vncPort"
                  type="number"
                  min="1024"
                  max="65535"
                  value={x11vncFormData.port}
                  onChange={(e) => setX11VNCFormData(prev => ({ ...prev, port: parseInt(e.target.value) || 5900 }))}
                  placeholder="5900"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default VNC port is 5900. Use ports 1024-65535.
                </p>
              </div>

              <div>
                <Label htmlFor="vncPassword">VNC Password *</Label>
                <div className="flex items-center gap-2">
                  <div className={`flex-1 px-3 py-2 border rounded-md bg-gray-50 ${x11vncFormData.enabled && !x11vncSettings?.hasPassword ? 'border-red-500' : 'border-gray-300'}`}>
                    <span className="text-gray-600 font-mono">
                      {x11vncSettings?.hasPassword ? '************' : 'No password set'}
                    </span>
                  </div>
                  <Popover open={passwordPopoverOpen} onOpenChange={setPasswordPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4 mr-1" />
                        Change
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="newPassword">New Password</Label>
                          <Input
                            id="newPassword"
                            type="password"
                            value={newPassword}
                            onChange={(e) => {
                              setNewPassword(e.target.value)
                              setPasswordError('')
                            }}
                            placeholder="Enter new password"
                            autoComplete="new-password"
                          />
                        </div>
                        <div>
                          <Label htmlFor="confirmPassword">Confirm Password</Label>
                          <Input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => {
                              setConfirmPassword(e.target.value)
                              setPasswordError('')
                            }}
                            placeholder="Confirm new password"
                            autoComplete="new-password"
                          />
                        </div>
                        {passwordError && (
                          <p className="text-xs text-red-600">{passwordError}</p>
                        )}
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={handlePasswordChange}
                            disabled={!newPassword || !confirmPassword}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            Set Password
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => {
                              setPasswordPopoverOpen(false)
                              setNewPassword('')
                              setConfirmPassword('')
                              setPasswordError('')
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Password is required for security. Remote connections are always allowed.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="autostart"
                    checked={x11vncFormData.autostart}
                    onChange={(e) => setX11VNCFormData(prev => ({ ...prev, autostart: e.target.checked }))}
                    className="rounded"
                  />
                  <Label htmlFor="autostart">Start automatically on boot</Label>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t">
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleConfigureX11VNC}
              disabled={
                !isApiConnected || 
                isConfiguringX11VNC || 
                !x11vncSettings?.installed ||
                (x11vncFormData.enabled && !x11vncSettings?.hasPassword && !passwordChanged)
              }
            >
              {isConfiguringX11VNC ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <MonitorSpeaker className="w-4 h-4 mr-2" />
              )}
              Apply Configuration
            </Button>
            
            {x11vncFormData.enabled && !x11vncSettings?.hasPassword && !passwordChanged && (
              <p className="text-xs text-red-600 mt-2">
                Password is required to enable VNC
              </p>
            )}
          </div>

        </CardContent>
      </Card>
    </div>
  )
} 