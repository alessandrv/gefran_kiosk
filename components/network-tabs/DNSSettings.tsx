"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Save, RefreshCw, Edit } from "lucide-react"
import { ValidatedInput } from "@/components/ui/validated-input"
import { NetworkInterface } from "@/lib/api"

interface DNSSettingsProps {
  dnsSettings: any
  interfaces: NetworkInterface[]
  isApiConnected: boolean
  isLoading: boolean
  onUpdateDNSSettings: (primary: string, secondary: string, searchDomains: string[]) => void
  onUpdateInterface: (id: string, config: any) => void
}

export default function DNSSettings({
  dnsSettings,
  interfaces,
  isApiConnected,
  isLoading,
  onUpdateDNSSettings,
  onUpdateInterface,
}: DNSSettingsProps) {
  const [dnsFormData, setDnsFormData] = useState({
    primary: '',
    secondary: '',
    searchDomain: ''
  })
  const [isUpdatingDNS, setIsUpdatingDNS] = useState(false)

  useEffect(() => {
    if (dnsSettings) {
      setDnsFormData({
        primary: dnsSettings.global.primary || '',
        secondary: dnsSettings.global.secondary || '',
        searchDomain: dnsSettings.global.searchDomains.join(', ') || ''
      })
    }
  }, [dnsSettings])

  const handleUpdateDNS = async () => {
    try {
      setIsUpdatingDNS(true)
      const searchDomains = dnsFormData.searchDomain
        .split(',')
        .map(domain => domain.trim())
        .filter(Boolean)
      
      await onUpdateDNSSettings(dnsFormData.primary, dnsFormData.secondary, searchDomains)
    } catch (error) {
      console.error('Failed to update DNS settings:', error)
    } finally {
      setIsUpdatingDNS(false)
    }
  }

  if (isLoading && !dnsSettings) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading DNS settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-blue-600">Global DNS Configuration</CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            These settings apply system-wide to all interfaces that don't have specific DNS configured.
            Changes will be saved to /etc/systemd/resolved.conf and applied globally.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="global-dns1">Primary DNS Server</Label>
              <ValidatedInput
                id="global-dns1"
                value={dnsFormData.primary}
                onChange={(e) => setDnsFormData(prev => ({ ...prev, primary: e.target.value }))}
                placeholder="8.8.8.8"
                disabled={!isApiConnected || isUpdatingDNS}
                validationType="dns"
              />
            </div>
            <div>
              <Label htmlFor="global-dns2">Secondary DNS Server</Label>
              <ValidatedInput
                id="global-dns2"
                value={dnsFormData.secondary}
                onChange={(e) => setDnsFormData(prev => ({ ...prev, secondary: e.target.value }))}
                placeholder="8.8.4.4"
                disabled={!isApiConnected || isUpdatingDNS}
                validationType="dns"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="search-domain">Search Domains (comma-separated)</Label>
            <Input
              id="search-domain"
              value={dnsFormData.searchDomain}
              onChange={(e) => setDnsFormData(prev => ({ ...prev, searchDomain: e.target.value }))}
              placeholder="example.com, local.domain"
              disabled={!isApiConnected || isUpdatingDNS}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
            <p className="text-xs text-gray-500 mt-1">
              Note: Search domains can contain commas to separate multiple domains.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleUpdateDNS}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!isApiConnected || isUpdatingDNS}
            >
              {isUpdatingDNS ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isUpdatingDNS ? 'Applying Changes...' : 'Apply Global DNS Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Interface-specific DNS settings */}
      {dnsSettings?.interfaces && Object.keys(dnsSettings.interfaces).length > 0 && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-blue-600">Interface-specific DNS</CardTitle>
            <p className="text-sm text-gray-600 mt-2">
              These interfaces have custom DNS settings that override the global DNS configuration.
              Edit individual interfaces to modify their DNS settings.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(dnsSettings.interfaces).map(([interfaceName, dns]: [string, any]) => (
                <div key={interfaceName} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <span className="font-medium">{interfaceName}</span>
                    <div className="text-sm text-gray-600">
                      Primary: {dns.primary || 'Not set'} | Secondary: {dns.secondary || 'Not set'}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const interfaceToEdit = interfaces.find(iface => iface.name === interfaceName)
                      if (interfaceToEdit) {
                        // This would trigger interface edit dialog - simplified for now
                        console.log('Edit interface DNS:', interfaceToEdit.name)
                      }
                    }}
                    disabled={!isApiConnected || isUpdatingDNS}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 