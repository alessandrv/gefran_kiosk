"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { OnScreenKeyboard } from "@/components/ui/on-screen-keyboard"
import toast from 'react-hot-toast'
import {
  Sun,
  Save,
  Activity,
  RefreshCw,
  AlertCircle,
  Plus,
  Minus,
  Keyboard,
} from "lucide-react"

interface ScreensaverSettingsProps {
  screensaverSettings: any
  isApiConnected: boolean
  isLoading: boolean
  onConfigureScreensaver: (config: any) => Promise<void>
  onTestScreensaver: () => Promise<void>
}

export default function ScreensaverSettings({
  screensaverSettings,
  isApiConnected,
  isLoading,
  onConfigureScreensaver,
  onTestScreensaver,
}: ScreensaverSettingsProps) {
  const [screensaverFormData, setScreensaverFormData] = useState({
    enabled: false,
    timeout: 600,
    lockScreen: false,
    lockTimeout: 900,
    dpmsEnabled: true,
    dpmsStandby: 1200,
    dpmsSuspend: 1800,
    dpmsOff: 3600,
    screensaverType: 'blank' as 'blank' | 'random' | 'specific',
    specificSaver: '',
    inhibitWhenFullscreen: true,
    fadeTime: 3000
  })
  const [isConfiguringScreensaver, setIsConfiguringScreensaver] = useState(false)
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const [activeInputField, setActiveInputField] = useState<string | null>(null)

  useEffect(() => {
    if (screensaverSettings) {
      setScreensaverFormData(prev => ({
        ...prev,
        ...screensaverSettings
      }))
    }
  }, [screensaverSettings])

  // Validation function for DPMS timeouts
  const validateDPMSTimeouts = () => {
    const { dpmsStandby, dpmsSuspend, dpmsOff } = screensaverFormData
    
    if (dpmsStandby > dpmsSuspend) {
      toast.error("Invalid Configuration: Standby timeout must be less than or equal to suspend timeout.")
      return false
    }
    
    if (dpmsSuspend > dpmsOff) {
      toast.error("Invalid Configuration: Suspend timeout must be less than or equal to off timeout.")
      return false
    }
    
    if (dpmsStandby > dpmsOff) {
      toast.error("Invalid Configuration: Standby timeout must be less than or equal to off timeout.")
      return false
    }
    
    return true
  }

  const handleConfigureScreensaver = async () => {
    if (!validateDPMSTimeouts()) {
      return
    }

    try {
      setIsConfiguringScreensaver(true)
      await onConfigureScreensaver(screensaverFormData)
      toast.success("Settings Applied: Screensaver settings have been applied successfully.")
    } catch (error) {
      console.error('Failed to configure screensaver:', error)
      toast.error("Configuration Failed: Failed to apply screensaver settings. Please try again.")
    } finally {
      setIsConfiguringScreensaver(false)
    }
  }

  const handleTestScreensaver = async () => {
    try {
      await onTestScreensaver()
      toast.success("Screensaver test initiated successfully.")
    } catch (error) {
      console.error('Failed to test screensaver:', error)
      toast.error("Test Failed: Failed to start screensaver test.")
    }
  }

  const handleKeyboardInput = (key: string) => {
    if (!activeInputField) return

    const inputElement = document.getElementById(activeInputField) as HTMLInputElement
    if (!inputElement) return

    if (key === 'Backspace') {
      const currentValue = inputElement.value
      const newValue = currentValue.slice(0, -1)
      inputElement.value = newValue
      
      // Trigger onChange event
      const event = new Event('input', { bubbles: true })
      inputElement.dispatchEvent(event)
    } else if (key === 'Enter') {
      inputElement.blur()
      setKeyboardVisible(false)
      setActiveInputField(null)
    } else {
      // Always append to the end of the field
      const currentValue = inputElement.value
      const newValue = currentValue + key
      
      inputElement.value = newValue
      inputElement.setSelectionRange(newValue.length, newValue.length)
      
      // Trigger onChange event
      const event = new Event('input', { bubbles: true })
      inputElement.dispatchEvent(event)
    }
  }

  const handleInputFocus = (fieldId: string) => {
    setActiveInputField(fieldId)
    setKeyboardVisible(true)
    
    // Set cursor to end of field after a short delay
    setTimeout(() => {
      const inputElement = document.getElementById(fieldId) as HTMLInputElement
      if (inputElement) {
        const length = inputElement.value.length
        inputElement.setSelectionRange(length, length)
      }
    }, 100)
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else {
      return `${minutes}m`
    }
  }



  return (
    <div className="space-y-6">
    
      {/* DPMS Power Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-blue-600">Power Management (DPMS)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="dpms-enabled" className="text-sm font-medium">
              Enable Power Management
            </Label>
            <Input
              id="dpms-enabled"
              type="checkbox"
              checked={screensaverFormData.dpmsEnabled}
              onChange={(e) => setScreensaverFormData(prev => ({ ...prev, dpmsEnabled: e.target.checked }))}
              className="w-4 h-4"
            />
          </div>

          {screensaverFormData.dpmsEnabled && (
            <>
              <div className="space-y-3">
                <Label className="text-sm font-medium">Monitor Standby Timeout</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setScreensaverFormData(prev => ({ 
                      ...prev, 
                      dpmsStandby: Math.max(300, prev.dpmsStandby - 300) 
                    }))}
                    disabled={screensaverFormData.dpmsStandby <= 300}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 text-center relative">
                    <Input
                      id="dpms-standby-input"
                      type="number"
                      value={screensaverFormData.dpmsStandby / 60}
                      onChange={(e) => {
                        const minutes = parseInt(e.target.value) || 5
                        const seconds = Math.max(300, Math.min(7200, minutes * 60))
                        setScreensaverFormData(prev => ({ ...prev, dpmsStandby: seconds }))
                      }}
                      onFocus={() => handleInputFocus('dpms-standby-input')}
                      className="text-center pr-8"
                      min={5}
                      max={120}
                      data-keyboard-input
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                      onClick={() => handleInputFocus('dpms-standby-input')}
                    >
                      <Keyboard className="h-3 w-3" />
                    </Button>
                    <span className="text-xs text-gray-500 block mt-1">minutes</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setScreensaverFormData(prev => ({ 
                      ...prev, 
                      dpmsStandby: Math.min(7200, prev.dpmsStandby + 300) 
                    }))}
                    disabled={screensaverFormData.dpmsStandby >= 7200}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Monitor Suspend Timeout</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setScreensaverFormData(prev => ({ 
                      ...prev, 
                      dpmsSuspend: Math.max(600, prev.dpmsSuspend - 300) 
                    }))}
                    disabled={screensaverFormData.dpmsSuspend <= 600}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 text-center relative">
                    <Input
                      id="dpms-suspend-input"
                      type="number"
                      value={screensaverFormData.dpmsSuspend / 60}
                      onChange={(e) => {
                        const minutes = parseInt(e.target.value) || 10
                        const seconds = Math.max(600, Math.min(7200, minutes * 60))
                        setScreensaverFormData(prev => ({ ...prev, dpmsSuspend: seconds }))
                      }}
                      onFocus={() => handleInputFocus('dpms-suspend-input')}
                      className="text-center pr-8"
                      min={10}
                      max={120}
                      data-keyboard-input
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                      onClick={() => handleInputFocus('dpms-suspend-input')}
                    >
                      <Keyboard className="h-3 w-3" />
                    </Button>
                    <span className="text-xs text-gray-500 block mt-1">minutes</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setScreensaverFormData(prev => ({ 
                      ...prev, 
                      dpmsSuspend: Math.min(7200, prev.dpmsSuspend + 300) 
                    }))}
                    disabled={screensaverFormData.dpmsSuspend >= 7200}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Monitor Off Timeout</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setScreensaverFormData(prev => ({ 
                      ...prev, 
                      dpmsOff: Math.max(900, prev.dpmsOff - 300) 
                    }))}
                    disabled={screensaverFormData.dpmsOff <= 900}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 text-center relative">
                    <Input
                      id="dpms-off-input"
                      type="number"
                      value={screensaverFormData.dpmsOff / 60}
                      onChange={(e) => {
                        const minutes = parseInt(e.target.value) || 15
                        const seconds = Math.max(900, Math.min(7200, minutes * 60))
                        setScreensaverFormData(prev => ({ ...prev, dpmsOff: seconds }))
                      }}
                      onFocus={() => handleInputFocus('dpms-off-input')}
                      className="text-center pr-8"
                      min={15}
                      max={120}
                      data-keyboard-input
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                      onClick={() => handleInputFocus('dpms-off-input')}
                    >
                      <Keyboard className="h-3 w-3" />
                    </Button>
                    <span className="text-xs text-gray-500 block mt-1">minutes</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setScreensaverFormData(prev => ({ 
                      ...prev, 
                      dpmsOff: Math.min(7200, prev.dpmsOff + 300) 
                    }))}
                    disabled={screensaverFormData.dpmsOff >= 7200}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

   

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button 
          onClick={handleConfigureScreensaver}
          disabled={isConfiguringScreensaver}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isConfiguringScreensaver ? (
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Apply Settings
        </Button>

        <Button 
          variant="outline"
          onClick={handleTestScreensaver}
          disabled={!screensaverSettings?.enabled}
        >
          <Activity className="h-4 w-4 mr-2" />
          Test Screensaver
        </Button>
      </div>

      {/* On-Screen Keyboard */}
      <OnScreenKeyboard
        isVisible={keyboardVisible}
        onKeyPress={handleKeyboardInput}
        onClose={() => {
          setKeyboardVisible(false)
          setActiveInputField(null)
        }}
        targetType="number"
      />
    </div>
  )
} 