"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Monitor,
  Save,
  RefreshCw,
} from "lucide-react"
import { ValidatedInput } from "@/components/ui/validated-input"

interface BrowserSettingsProps {
  browserSettings: any
  isApiConnected: boolean
  isLoading: boolean
  onUpdateBrowserSettings: (homepage: string, showHomeButton: boolean) => Promise<void>
}

export default function BrowserSettings({
  browserSettings,
  isApiConnected,
  isLoading,
  onUpdateBrowserSettings,
}: BrowserSettingsProps) {
  const [browserFormData, setBrowserFormData] = useState({
    homepage: '',
    showHomeButton: true
  })
  const [isUpdatingBrowser, setIsUpdatingBrowser] = useState(false)

  useEffect(() => {
    if (browserSettings) {
      setBrowserFormData({
        homepage: browserSettings.homepage || '',
        showHomeButton: browserSettings.showHomeButton !== undefined ? browserSettings.showHomeButton : true
      })
    }
  }, [browserSettings])

  const handleUpdateBrowser = async () => {
    try {
      setIsUpdatingBrowser(true)
      await onUpdateBrowserSettings(browserFormData.homepage, browserFormData.showHomeButton)
    } catch (error) {
      console.error('Failed to update browser settings:', error)
    } finally {
      setIsUpdatingBrowser(false)
    }
  }

  if (isLoading && !browserSettings) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading browser settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Browser Homepage Settings */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-blue-600 flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Chromium Browser Configuration
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Configure the default homepage and startup behavior for the Chromium browser.
            Changes will be saved to the kiosk user's Chromium preferences.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="browser-homepage">Homepage URL</Label>
            <ValidatedInput
              id="browser-homepage"
              value={browserFormData.homepage}
              onChange={(e) => setBrowserFormData(prev => ({ ...prev, homepage: e.target.value }))}
              placeholder="https://www.google.com"
              disabled={!isApiConnected || isUpdatingBrowser}
              validationType="url"
            />
            <p className="text-xs text-gray-500 mt-1">
              This URL will be set as the browser homepage and startup page
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="show-home-button"
              checked={browserFormData.showHomeButton}
              onChange={(e) => setBrowserFormData(prev => ({ ...prev, showHomeButton: e.target.checked }))}
              disabled={!isApiConnected || isUpdatingBrowser}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <Label htmlFor="show-home-button" className="text-sm">
              Show home button in browser toolbar
            </Label>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleUpdateBrowser}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!isApiConnected || isUpdatingBrowser || !browserFormData.homepage}
            >
              {isUpdatingBrowser ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isUpdatingBrowser ? 'Applying Changes...' : 'Apply Browser Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Browser Settings Display */}
      {browserSettings && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-blue-600">Current Browser Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Homepage:</span>
                <span className="font-mono text-sm">{browserSettings.homepage}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Home Button:</span>
                <Badge className={browserSettings.showHomeButton ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                  {browserSettings.showHomeButton ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Startup URLs:</span>
                <div className="text-right">
                  {browserSettings.startupUrls.map((url: string, index: number) => (
                    <div key={index} className="font-mono text-sm">{url}</div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 