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
} from "lucide-react"
import { Slider } from "@/components/ui/slider"

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
                <div className="flex items-center gap-4">
                  <Slider
                    value={[screensaverFormData.dpmsStandby]}
                    onValueChange={(value) => setScreensaverFormData(prev => ({ ...prev, dpmsStandby: value[0] }))}
                    max={7200}
                    min={300}
                    step={300}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-600 min-w-[60px]">
                    {formatTime(screensaverFormData.dpmsStandby)}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Monitor Suspend Timeout</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[screensaverFormData.dpmsSuspend]}
                    onValueChange={(value) => setScreensaverFormData(prev => ({ ...prev, dpmsSuspend: value[0] }))}
                    max={7200}
                    min={600}
                    step={300}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-600 min-w-[60px]">
                    {formatTime(screensaverFormData.dpmsSuspend)}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Monitor Off Timeout</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[screensaverFormData.dpmsOff]}
                    onValueChange={(value) => setScreensaverFormData(prev => ({ ...prev, dpmsOff: value[0] }))}
                    max={7200}
                    min={900}
                    step={300}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-600 min-w-[60px]">
                    {formatTime(screensaverFormData.dpmsOff)}
                  </span>
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