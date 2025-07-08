"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Sun,
  Save,
  Activity,
  RefreshCw,
  AlertCircle,
  Plus,
  Minus,
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

  useEffect(() => {
    if (screensaverSettings) {
      setScreensaverFormData(prev => ({
        ...prev,
        ...screensaverSettings
      }))
    }
  }, [screensaverSettings])

  const handleConfigureScreensaver = async () => {
    try {
      setIsConfiguringScreensaver(true)
      await onConfigureScreensaver(screensaverFormData)
    } catch (error) {
      console.error('Failed to configure screensaver:', error)
    } finally {
      setIsConfiguringScreensaver(false)
    }
  }

  const handleTestScreensaver = async () => {
    try {
      await onTestScreensaver()
    } catch (error) {
      console.error('Failed to test screensaver:', error)
    }
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
                  <div className="flex-1 text-center">
                    <Input
                      type="number"
                      value={screensaverFormData.dpmsStandby / 60}
                      onChange={(e) => {
                        const minutes = parseInt(e.target.value) || 5
                        const seconds = Math.max(300, Math.min(7200, minutes * 60))
                        setScreensaverFormData(prev => ({ ...prev, dpmsStandby: seconds }))
                      }}
                      className="text-center"
                      min={5}
                      max={120}
                    />
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
                  <div className="flex-1 text-center">
                    <Input
                      type="number"
                      value={screensaverFormData.dpmsSuspend / 60}
                      onChange={(e) => {
                        const minutes = parseInt(e.target.value) || 10
                        const seconds = Math.max(600, Math.min(7200, minutes * 60))
                        setScreensaverFormData(prev => ({ ...prev, dpmsSuspend: seconds }))
                      }}
                      className="text-center"
                      min={10}
                      max={120}
                    />
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
                  <div className="flex-1 text-center">
                    <Input
                      type="number"
                      value={screensaverFormData.dpmsOff / 60}
                      onChange={(e) => {
                        const minutes = parseInt(e.target.value) || 15
                        const seconds = Math.max(900, Math.min(7200, minutes * 60))
                        setScreensaverFormData(prev => ({ ...prev, dpmsOff: seconds }))
                      }}
                      className="text-center"
                      min={15}
                      max={120}
                    />
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

     
    </div>
  )
} 