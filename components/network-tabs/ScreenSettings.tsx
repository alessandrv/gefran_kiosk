"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Sun,
  RotateCcw,
  RefreshCw,
  Plus,
  Minus,
} from "lucide-react"

interface ScreenSettingsProps {
  screenSettings: any
  isApiConnected: boolean
  isLoading: boolean
  onSetScreenBrightness: (brightness: number) => Promise<void>
  onRotateScreenLeft: () => Promise<void>
  onRotateScreenRight: () => Promise<void>
  onResetScreenRotation: () => Promise<void>
}

export default function ScreenSettings({
  screenSettings,
  isApiConnected,
  isLoading,
  onSetScreenBrightness,
  onRotateScreenLeft,
  onRotateScreenRight,
  onResetScreenRotation,
}: ScreenSettingsProps) {
  const [isUpdatingBrightness, setIsUpdatingBrightness] = useState(false)
  const [brightnessValue, setBrightnessValue] = useState([50])
  const [isRotating, setIsRotating] = useState(false)
  const [rotationMessage, setRotationMessage] = useState<string | null>(null)

  useEffect(() => {
    if (screenSettings?.brightness) {
      setBrightnessValue([screenSettings.brightness])
    }
  }, [screenSettings])

  const handleBrightnessChange = async (value: number[]) => {
    setBrightnessValue(value)
    try {
      setIsUpdatingBrightness(true)
      await onSetScreenBrightness(value[0])
    } catch (error) {
      console.error('Failed to set brightness:', error)
    } finally {
      setIsUpdatingBrightness(false)
    }
  }

  const handleRotate = async (direction: 'left' | 'right' | 'reset') => {
    setIsRotating(true)
    setRotationMessage(null)
    try {
      if (direction === 'left') {
        await onRotateScreenLeft()
        setRotationMessage('Rotated left')
      } else if (direction === 'right') {
        await onRotateScreenRight()
        setRotationMessage('Rotated right')
      } else {
        await onResetScreenRotation()
        setRotationMessage('Reset to normal')
      }
    } catch (e: any) {
      setRotationMessage(e.message || 'Error')
    } finally {
      setIsRotating(false)
    }
  }

  if (isLoading && !screenSettings) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading screen settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Brightness Control */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-blue-600 flex items-center gap-2">
            <Sun className="w-5 h-5" />
            Screen Brightness
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Adjust the screen brightness. Changes are applied immediately.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {screenSettings && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Brightness</span>
                <span className="text-sm text-gray-600">
                  {brightnessValue[0]}%
                  {isUpdatingBrightness && (
                    <RefreshCw className="w-3 h-3 ml-2 animate-spin inline" />
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const newValue = Math.max(1, brightnessValue[0] - 10)
                    setBrightnessValue([newValue])
                    await handleBrightnessChange([newValue])
                  }}
                  disabled={!isApiConnected || isUpdatingBrightness || brightnessValue[0] <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="flex-1 text-center">
                  <Input
                    type="number"
                    value={brightnessValue[0]}
                    onChange={(e) => {
                      const value = Math.max(1, Math.min(100, parseInt(e.target.value) || 1))
                      setBrightnessValue([value])
                    }}
                    onBlur={async () => {
                      await handleBrightnessChange(brightnessValue)
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        await handleBrightnessChange(brightnessValue)
                      }
                    }}
                    className="text-center"
                    min={1}
                    max={100}
                    disabled={!isApiConnected || isUpdatingBrightness}
                  />
                  <span className="text-xs text-gray-500 block mt-1">percent</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const newValue = Math.min(100, brightnessValue[0] + 10)
                    setBrightnessValue([newValue])
                    await handleBrightnessChange([newValue])
                  }}
                  disabled={!isApiConnected || isUpdatingBrightness || brightnessValue[0] >= 100}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>1%</span>
                <span>100%</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rotation Control */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-blue-600 flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Screen Rotation
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Rotate the display and touchscreen. Use the buttons below. Changes are persistent.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={() => handleRotate('left')}
              disabled={isRotating || !isApiConnected}
              className="flex-1"
            >
              {isRotating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2 -rotate-90" />}
              Rotate Left
            </Button>
            <Button
              onClick={() => handleRotate('right')}
              disabled={isRotating || !isApiConnected}
              className="flex-1"
            >
              {isRotating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2 rotate-90" />}
              Rotate Right
            </Button>
            <Button
              onClick={() => handleRotate('reset')}
              disabled={isRotating || !isApiConnected}
              className="flex-1"
              variant="destructive"
            >
              {isRotating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Reset
            </Button>
          </div>
          {rotationMessage && <div className="text-xs text-center text-blue-700 pt-2">{rotationMessage}</div>}
        </CardContent>
      </Card>

      {/* Current Settings Display */}
      {screenSettings && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-blue-600">Current Display Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Brightness:</span>
                <span className="font-medium">{screenSettings.brightness}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Rotation:</span>
                <Badge className="bg-blue-100 text-blue-800 capitalize">
                  {screenSettings.rotation}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 