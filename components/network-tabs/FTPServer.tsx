"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  HardDrive,
  Activity,
  CheckCircle,
  X,
  AlertCircle,
  RefreshCw,
} from "lucide-react"
import { ValidatedInput } from "@/components/ui/validated-input"

interface FTPServerProps {
  ftpSettings: any
  ftpLogs: any[]
  isApiConnected: boolean
  isLoading: boolean
  onConfigureFTP: (config: any) => Promise<void>
  onStopFTP: () => Promise<void>
  onFetchFTPLogs: (lines: number) => Promise<void>
}

export default function FTPServer({
  ftpSettings,
  ftpLogs,
  isApiConnected,
  isLoading,
  onConfigureFTP,
  onStopFTP,
  onFetchFTPLogs,
}: FTPServerProps) {
  const [ftpFormData, setFtpFormData] = useState({
    enabled: false,
    port: 21,
    dataPort: 20,
    passiveMode: true,
    allowAnonymous: false,
    allowLocalUsers: true,
    ftpUser: '',
    ftpPassword: '',
    passivePortRange: '49152-65534',
    autostart: false
  })
  const [ftpPasswordChanged, setFtpPasswordChanged] = useState(false)
  const [isConfiguringFTP, setIsConfiguringFTP] = useState(false)
  const [isLoadingFtpLogs, setIsLoadingFtpLogs] = useState(false)

  useEffect(() => {
    if (ftpSettings) {
      setFtpFormData({
        enabled: ftpSettings.enabled || false,
        port: ftpSettings.port || 21,
        dataPort: ftpSettings.dataPort || 20,
        passiveMode: ftpSettings.passiveMode !== undefined ? ftpSettings.passiveMode : true,
        allowAnonymous: ftpSettings.allowAnonymous || false,
        allowLocalUsers: ftpSettings.allowLocalUsers !== undefined ? ftpSettings.allowLocalUsers : true,
        ftpUser: ftpSettings.ftpUser || '',
        ftpPassword: '',
        passivePortRange: ftpSettings.passivePortRange || '49152-65534',
        autostart: false
      })
      setFtpPasswordChanged(false)
    }
  }, [ftpSettings])

  const handleConfigureFTP = async () => {
    try {
      setIsConfiguringFTP(true)
      
      const config = {
        ...ftpFormData,
        ftpPassword: ftpPasswordChanged ? ftpFormData.ftpPassword : undefined
      }
      
      await onConfigureFTP(config)
      
      alert(ftpFormData.enabled ? 'FTP server configured successfully!' : 'FTP server disabled successfully!')
      
      setFtpPasswordChanged(false)
    } catch (error: any) {
      alert(`Failed to configure FTP server: ${error.message}`)
    } finally {
      setIsConfiguringFTP(false)
    }
  }

  const handleStopFTP = async () => {
    try {
      setIsConfiguringFTP(true)
      await onStopFTP()
      alert('FTP server stopped successfully!')
    } catch (error: any) {
      alert(`Failed to stop FTP server: ${error.message}`)
    } finally {
      setIsConfiguringFTP(false)
    }
  }

  const handleLoadLogs = async () => {
    try {
      setIsLoadingFtpLogs(true)
      await onFetchFTPLogs(50)
    } catch (error: any) {
      alert(`Failed to load FTP logs: ${error.message}`)
    } finally {
      setIsLoadingFtpLogs(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-600">
            <HardDrive className="h-5 w-5" />
            FTP Server Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!ftpSettings?.installed && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                FTP server (vsftpd) is not installed. Install it first: <code>sudo apt install vsftpd</code>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="ftpEnabled"
                  checked={ftpFormData.enabled}
                  onChange={(e) => setFtpFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="ftpEnabled" className="text-sm font-medium">
                  Enable FTP Server
                </Label>
              </div>

              <div>
                <Label htmlFor="ftpPort" className="text-sm font-medium">FTP Port</Label>
                <ValidatedInput
                  id="ftpPort"
                  type="number"
                  value={ftpFormData.port.toString()}
                  onChange={(e) => setFtpFormData(prev => ({ ...prev, port: parseInt(e.target.value) || 21 }))}
                  placeholder="21"
                  validationType="number"
                  min={1}
                  max={65535}
                  disabled={!ftpFormData.enabled}
                />
              </div>

              <div>
                <Label htmlFor="ftpDataPort" className="text-sm font-medium">Data Port</Label>
                <ValidatedInput
                  id="ftpDataPort"
                  type="number"
                  value={ftpFormData.dataPort.toString()}
                  onChange={(e) => setFtpFormData(prev => ({ ...prev, dataPort: parseInt(e.target.value) || 20 }))}
                  placeholder="20"
                  validationType="number"
                  min={1}
                  max={65535}
                  disabled={!ftpFormData.enabled}
                />
              </div>

              <div>
                <Label htmlFor="ftpPassivePortRange" className="text-sm font-medium">Passive Port Range</Label>
                <ValidatedInput
                  id="ftpPassivePortRange"
                  value={ftpFormData.passivePortRange}
                  onChange={(e) => setFtpFormData(prev => ({ ...prev, passivePortRange: e.target.value }))}
                  placeholder="49152-65534"
                  disabled={!ftpFormData.enabled}
                />
                <p className="text-xs text-gray-500 mt-1">Format: min-max (e.g., 49152-65534)</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="ftpPassiveMode"
                  checked={ftpFormData.passiveMode}
                  onChange={(e) => setFtpFormData(prev => ({ ...prev, passiveMode: e.target.checked }))}
                  disabled={!ftpFormData.enabled}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="ftpPassiveMode" className="text-sm font-medium">
                  Enable Passive Mode
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="ftpAllowAnonymous"
                  checked={ftpFormData.allowAnonymous}
                  onChange={(e) => setFtpFormData(prev => ({ ...prev, allowAnonymous: e.target.checked }))}
                  disabled={!ftpFormData.enabled}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="ftpAllowAnonymous" className="text-sm font-medium">
                  Allow Anonymous Access
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="ftpAllowLocalUsers"
                  checked={ftpFormData.allowLocalUsers}
                  onChange={(e) => setFtpFormData(prev => ({ ...prev, allowLocalUsers: e.target.checked }))}
                  disabled={!ftpFormData.enabled}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="ftpAllowLocalUsers" className="text-sm font-medium">
                  Allow Local Users
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="ftpAutostart"
                  checked={ftpFormData.autostart}
                  onChange={(e) => setFtpFormData(prev => ({ ...prev, autostart: e.target.checked }))}
                  disabled={!ftpFormData.enabled}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="ftpAutostart" className="text-sm font-medium">
                  Start on Boot
                </Label>
              </div>
            </div>
          </div>

          {ftpFormData.enabled && ftpFormData.allowLocalUsers && (
            <div className="border-t pt-4 space-y-4">
              <h4 className="font-medium text-gray-900">FTP User Account</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ftpUser" className="text-sm font-medium">FTP Username</Label>
                  <ValidatedInput
                    id="ftpUser"
                    value={ftpFormData.ftpUser}
                    onChange={(e) => setFtpFormData(prev => ({ ...prev, ftpUser: e.target.value }))}
                    placeholder="ftpuser"
                    validationType="text"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty to use existing users only</p>
                </div>
                <div>
                  <Label htmlFor="ftpPassword" className="text-sm font-medium">FTP Password</Label>
                  <ValidatedInput
                    id="ftpPassword"
                    type="password"
                    value={ftpFormData.ftpPassword}
                    onChange={(e) => {
                      setFtpFormData(prev => ({ ...prev, ftpPassword: e.target.value }))
                      setFtpPasswordChanged(true)
                    }}
                    placeholder={ftpPasswordChanged ? "Enter new password" : "Leave empty to keep current"}
                    validationType="text"
                  />
                  <p className="text-xs text-gray-500 mt-1">Required when creating a new FTP user</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <Button 
              onClick={handleConfigureFTP}
              disabled={isConfiguringFTP || !ftpSettings?.installed}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isConfiguringFTP ? 'Configuring...' : (ftpFormData.enabled ? 'Apply Configuration' : 'Disable FTP Server')}
            </Button>
            
            {ftpSettings?.running && (
              <Button 
                onClick={handleStopFTP}
                disabled={isConfiguringFTP}
                variant="destructive"
              >
                {isConfiguringFTP ? 'Stopping...' : 'Stop FTP Server'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-600">
            <Activity className="h-5 w-5" />
            FTP Server Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-600">Installation Status</div>
              <div className="flex items-center gap-2 mt-1">
                {ftpSettings?.installed ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-green-600">Installed</span>
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 text-red-600" />
                    <span className="text-red-600">Not Installed</span>
                  </>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Service Status</div>
              <div className="flex items-center gap-2 mt-1">
                {ftpSettings?.running ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-green-600">Running</span>
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 text-red-600" />
                    <span className="text-red-600">Stopped</span>
                  </>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">FTP Port</div>
              <div className="text-lg font-semibold text-gray-900 mt-1">
                {ftpSettings?.port || 21}
              </div>
            </div>
          </div>

          {ftpSettings?.running && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">Connection Information</h4>
              <div className="text-sm space-y-1">
                <div><strong>FTP Server:</strong> ftp://[server-ip]:{ftpSettings.port}</div>
                <div><strong>Data Port:</strong> {ftpSettings.dataPort}</div>
                <div><strong>Passive Mode:</strong> {ftpSettings.passiveMode ? 'Enabled' : 'Disabled'}</div>
                {ftpSettings.passiveMode && (
                  <div><strong>Passive Port Range:</strong> {ftpSettings.passivePortRange}</div>
                )}
                <div><strong>Anonymous Access:</strong> {ftpSettings.allowAnonymous ? 'Allowed' : 'Disabled'}</div>
                <div><strong>Local Users:</strong> {ftpSettings.allowLocalUsers ? 'Allowed' : 'Disabled'}</div>
                {ftpSettings.ftpUser && (
                  <div><strong>FTP User:</strong> {ftpSettings.ftpUser}</div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-600">
            <Activity className="h-5 w-5" />
            FTP Server Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-600">Recent FTP server activity and connections</p>
            <Button 
              onClick={handleLoadLogs} 
              disabled={isLoadingFtpLogs}
              variant="outline"
              size="sm"
            >
              {isLoadingFtpLogs ? 'Loading...' : 'Refresh Logs'}
            </Button>
          </div>

          {ftpLogs.length > 0 ? (
            <div className="space-y-4">
              {ftpLogs.map((logSource, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2 capitalize">{logSource.source.replace('-', ' ')}</h4>
                  <div className="bg-gray-50 p-3 rounded border max-h-64 overflow-y-auto">
                    <div className="font-mono text-sm space-y-1">
                      {logSource.entries.slice(0, 20).map((entry: any, entryIndex: number) => (
                        <div key={entryIndex} className="text-gray-700">
                          <span className="text-gray-500">{entry.timestamp}</span> {entry.message}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No FTP logs available</p>
              <p className="text-sm">Logs will appear here when the FTP server is active</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 