"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Clock,
  Globe,
  Save,
  RefreshCw,
  Settings,
  Wifi,
  Server,
} from "lucide-react"
import { ValidatedInput } from "@/components/ui/validated-input"
import toast from 'react-hot-toast'

interface GeneralSettingsProps {
  ntpSettings: any
  hostnameInfo: any
  isApiConnected: boolean
  isLoading: boolean
  onUpdateNTPSettings: (primary: string, fallback: string) => Promise<void>
  onUpdateHostname: (hostname: string) => Promise<void>
}

export default function GeneralSettings({
  ntpSettings,
  hostnameInfo,
  isApiConnected,
  isLoading,
  onUpdateNTPSettings,
  onUpdateHostname,
}: GeneralSettingsProps) {
  const [ntpFormData, setNtpFormData] = useState({
    primary: '',
    fallback: ''
  })
  const [isUpdatingNTP, setIsUpdatingNTP] = useState(false)
  
  const [hostnameFormData, setHostnameFormData] = useState({
    hostname: ''
  })
  const [isUpdatingHostname, setIsUpdatingHostname] = useState(false)

  useEffect(() => {
    if (ntpSettings) {
      setNtpFormData({
        primary: ntpSettings.primary || '',
        fallback: ntpSettings.fallback || ''
      })
    }
  }, [ntpSettings])

  useEffect(() => {
    if (hostnameInfo) {
      setHostnameFormData({
        hostname: hostnameInfo.current || ''
      })
    }
  }, [hostnameInfo])

  const handleUpdateNTP = async () => {
    try {
      setIsUpdatingNTP(true)
      await onUpdateNTPSettings(ntpFormData.primary, ntpFormData.fallback)
      toast.success('NTP settings updated successfully')
    } catch (error: any) {
      console.error('Failed to update NTP settings:', error)
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to update NTP settings'
      toast.error(`NTP Update Failed: ${errorMessage}`)
    } finally {
      setIsUpdatingNTP(false)
    }
  }

  const handleUpdateHostname = async () => {
    if (!hostnameFormData.hostname.trim()) {
      toast.error('Hostname cannot be empty')
      return
    }

    if (!/^[a-zA-Z0-9-]+$/.test(hostnameFormData.hostname)) {
      toast.error('Hostname can only contain letters, numbers, and hyphens')
      return
    }

    try {
      setIsUpdatingHostname(true)
      await onUpdateHostname(hostnameFormData.hostname)
      toast.success('Hostname updated successfully. Reboot required for full effect.')
    } catch (error: any) {
      console.error('Failed to update hostname:', error)
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to update hostname'
      toast.error(`Hostname Update Failed: ${errorMessage}`)
    } finally {
      setIsUpdatingHostname(false)
    }
  }

  if (isLoading && (!ntpSettings || !hostnameInfo)) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading general settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* System Hostname Configuration */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-blue-600 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            System Hostname
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Configure the system hostname. Changes will be applied to /etc/hostname and /etc/hosts.
            A reboot may be required for all changes to take effect.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {hostnameInfo && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-gray-600">
                <div><strong>Current Hostname:</strong> {hostnameInfo.current}</div>
                <div><strong>Static Hostname:</strong> {hostnameInfo.static}</div>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="hostname">New Hostname</Label>
            <ValidatedInput
              id="hostname"
              value={hostnameFormData.hostname}
              onChange={(e) => setHostnameFormData(prev => ({ ...prev, hostname: e.target.value }))}
              placeholder="gefran-device"
              disabled={!isApiConnected || isUpdatingHostname}
              validationType="text"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use only letters, numbers, and hyphens. Must start and end with alphanumeric character.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleUpdateHostname}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!isApiConnected || isUpdatingHostname || !hostnameFormData.hostname || hostnameFormData.hostname === hostnameInfo?.current}
            >
              {isUpdatingHostname ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isUpdatingHostname ? 'Updating Hostname...' : 'Update Hostname'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* NTP Settings */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-blue-600 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            NTP Time Synchronization
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Configure Network Time Protocol (NTP) servers for automatic time synchronization.
            Changes will be saved to /etc/systemd/timesyncd.conf and applied system-wide.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {ntpSettings && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${ntpSettings.status.synchronized ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <span className="font-medium">
                  Time Sync: {ntpSettings.status.synchronized ? 'Synchronized' : 'Not Synchronized (takes some time after reboot)'}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                <div>Service: {ntpSettings.status.ntpService}</div>
                {ntpSettings.status.server && (
                  <div>Current Server: {ntpSettings.status.server}</div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ntp-primary">Primary NTP Server</Label>
              <ValidatedInput
                id="ntp-primary"
                value={ntpFormData.primary}
                onChange={(e) => setNtpFormData(prev => ({ ...prev, primary: e.target.value }))}
                placeholder="pool.ntp.org"
                disabled={!isApiConnected || isUpdatingNTP}
                validationType="dns"
              />
              <p className="text-xs text-gray-500 mt-1">
                Primary NTP server hostname or IP address
              </p>
            </div>
            <div>
              <Label htmlFor="ntp-fallback">Fallback NTP Server</Label>
              <ValidatedInput
                id="ntp-fallback"
                value={ntpFormData.fallback}
                onChange={(e) => setNtpFormData(prev => ({ ...prev, fallback: e.target.value }))}
                placeholder="time.nist.gov (optional)"
                disabled={!isApiConnected || isUpdatingNTP}
                validationType="dns"
              />
              <p className="text-xs text-gray-500 mt-1">
                Fallback server used if primary is unavailable
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleUpdateNTP}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!isApiConnected || isUpdatingNTP || !ntpFormData.primary}
            >
              {isUpdatingNTP ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isUpdatingNTP ? 'Applying Changes...' : 'Apply NTP Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 