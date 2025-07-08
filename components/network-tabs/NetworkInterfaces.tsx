"use client"

import React, { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import {
  Network,
  Wifi,
  Cable,
  Settings,
  CheckCircle,
  X,
  RefreshCw,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  AlertCircle,
  Globe,
  WifiOff,
  Save,
  Edit,
  Search,
  Lock,
  Unlock,
  Signal,
} from "lucide-react"
import { NetworkInterface, WiFiNetwork, WiFiConnectionRequest } from "@/lib/api"
import { ValidatedInput } from "@/components/ui/validated-input"
import toast from 'react-hot-toast'

interface NetworkInterfacesProps {
  interfaces: NetworkInterface[]
  wifiNetworks: WiFiNetwork[]
  wifiStatus: Record<string, any>
  dnsSettings: any
  isApiConnected: boolean
  isLoading: boolean
  onToggleInterface: (id: string) => void
  onUpdateInterface: (id: string, config: any) => void
  onScanWifiNetworks: (interfaceName: string) => void
  onConnectToWifiNetwork: (interfaceName: string, request: WiFiConnectionRequest) => void
  onDisconnectWifiNetwork: (interfaceName: string) => void
  onForgetWifiNetwork: (ssid: string) => void
}

export default function NetworkInterfaces({
  interfaces,
  wifiNetworks,
  wifiStatus,
  dnsSettings,
  isApiConnected,
  isLoading,
  onToggleInterface,
  onUpdateInterface,
  onScanWifiNetworks,
  onConnectToWifiNetwork,
  onDisconnectWifiNetwork,
  onForgetWifiNetwork,
}: NetworkInterfacesProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedInterface, setSelectedInterface] = useState<NetworkInterface | null>(null)
  const [isToggling, setIsToggling] = useState<string | null>(null)
  const [isUpdatingInterface, setIsUpdatingInterface] = useState(false)
  
  // WiFi state
  const [wifiScanDialogOpen, setWifiScanDialogOpen] = useState(false)
  const [wifiConnectDialogOpen, setWifiConnectDialogOpen] = useState(false)
  const [selectedWifiNetwork, setSelectedWifiNetwork] = useState<WiFiNetwork | null>(null)
  const [selectedWifiInterface, setSelectedWifiInterface] = useState<string>('')
  const [isScanning, setIsScanning] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [wifiPassword, setWifiPassword] = useState('')

  const handleToggleInterface = async (id: string) => {
    setIsToggling(id)
    try {
      await onToggleInterface(id)
    } catch (error) {
      console.error('Failed to toggle interface:', error)
    } finally {
      setIsToggling(null)
    }
  }

  const handleEditInterface = (iface: NetworkInterface) => {
    setSelectedInterface(iface)
    setEditDialogOpen(true)
  }

  const InterfaceEditDialog = ({
    interface: iface,
    open,
    onOpenChange,
  }: {
    interface: NetworkInterface | null
    open: boolean
    onOpenChange: (open: boolean) => void
  }) => {
    const [formData, setFormData] = useState<NetworkInterface>(
      iface || {
        id: "",
        name: "",
        mac: "",
        type: "Static",
        address: "",
        secondaryAddress: "",
        netmask: "",
        gateway: "",
        dns1: "",
        dns2: "",
        status: "inactive",
        enabled: false,
      },
    )

    React.useEffect(() => {
      if (open && iface) {
        const interfaceDNS = dnsSettings?.interfaces?.[iface.name]
        const updatedInterface = {
          ...iface,
          dns1: interfaceDNS?.primary || iface.dns1 || '',
          dns2: interfaceDNS?.secondary || iface.dns2 || ''
        }
        setFormData(updatedInterface)
      }
    }, [open, iface, dnsSettings])

    const handleSave = async () => {
      try {
        setIsUpdatingInterface(true)
        if (formData.type === "DHCP") {
          await onUpdateInterface(formData.id, {
            address: "",
            netmask: "",
            gateway: "",
            dns1: formData.dns1,
            dns2: formData.dns2,
          })
        } else {
          await onUpdateInterface(formData.id, {
            address: formData.address,
            netmask: formData.netmask,
            gateway: formData.gateway,
            dns1: formData.dns1,
            dns2: formData.dns2,
          })
        }
        onOpenChange(false)
      } catch (error) {
        console.error('Failed to update interface:', error)
      } finally {
        setIsUpdatingInterface(false)
      }
    }

    const handleCancel = () => {
      if (!isUpdatingInterface) {
        onOpenChange(false)
      }
    }

    return (
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-blue-600">
            Edit {formData.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Settings</TabsTrigger>
            <TabsTrigger value="network">Network Config</TabsTrigger>
            <TabsTrigger value="dns">DNS Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Interface Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  disabled
                  className="bg-gray-50"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
              </div>
              <div>
                <Label htmlFor="mac">MAC Address</Label>
                <Input
                  id="mac"
                  value={formData.mac}
                  disabled
                  className="bg-gray-50"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="type">Configuration Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: "DHCP" | "Static") => setFormData((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DHCP">DHCP</SelectItem>
                  <SelectItem value="Static">Static</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="network" className="space-y-4">
            {formData.type === "Static" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="address">IP Address</Label>
                    <ValidatedInput
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                      placeholder="192.168.1.100"
                      validationType="ip"
                    />
                  </div>
                  <div>
                    <Label htmlFor="netmask">Netmask</Label>
                    <ValidatedInput
                      id="netmask"
                      value={formData.netmask}
                      onChange={(e) => setFormData((prev) => ({ ...prev, netmask: e.target.value }))}
                      placeholder="255.255.255.0"
                      validationType="ip"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="gateway">Default Gateway</Label>
                    <ValidatedInput
                      id="gateway"
                      value={formData.gateway ?? ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, gateway: e.target.value }))}
                      placeholder="192.168.1.1"
                      validationType="ip"
                    />
                  </div>
                  <div>
                    <Label htmlFor="secondary">Secondary Address</Label>
                    <ValidatedInput
                      id="secondary"
                      value={formData.secondaryAddress}
                      onChange={(e) => setFormData((prev) => ({ ...prev, secondaryAddress: e.target.value }))}
                      placeholder="192.168.1.101"
                      validationType="ip"
                    />
                  </div>
                </div>
              </>
            )}

            {formData.type === "DHCP" && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  Network configuration will be automatically obtained from DHCP server.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="dns" className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg mb-4">
              <p className="text-sm text-blue-700">
                <strong>Interface-specific DNS:</strong> These DNS settings will only apply to this network interface. 
                Leave empty to use global DNS settings.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dns1">Primary DNS (Interface)</Label>
                <ValidatedInput
                  id="dns1"
                  value={formData.dns1}
                  onChange={(e) => setFormData((prev) => ({ ...prev, dns1: e.target.value }))}
                  placeholder="8.8.8.8 (leave empty for global DNS)"
                  validationType="dns"
                />
              </div>
              <div>
                <Label htmlFor="dns2">Secondary DNS (Interface)</Label>
                <ValidatedInput
                  id="dns2"
                  value={formData.dns2}
                  onChange={(e) => setFormData((prev) => ({ ...prev, dns2: e.target.value }))}
                  placeholder="8.8.4.4 (leave empty for global DNS)"
                  validationType="dns"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleCancel} disabled={isUpdatingInterface}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700" disabled={isUpdatingInterface}>
            {isUpdatingInterface ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {isUpdatingInterface ? 'Updating...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    )
  }

  if (isLoading && interfaces.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading network interfaces...</span>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        {interfaces.map((iface) => (
          <Card
            key={iface.id}
            className={`border-2 ${
              iface.status === "active" ? "border-green-400 bg-green-50" : "border-gray-300 bg-white"
            }`}
          >
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                      {iface.name && (iface.name.includes('eth') || iface.name.includes('en')) ? (
                        <Cable className="w-4 h-4 text-white" />
                      ) : (
                        <Wifi className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <span className="font-semibold text-gray-900">{iface.name || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {iface.status === "active" && <div className="w-3 h-3 bg-green-500 rounded-full"></div>}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleEditInterface(iface)}
                      disabled={!isApiConnected}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    {(iface.name && (iface.name.includes('wl') || iface.name.includes('wifi'))) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedWifiInterface(iface.name)
                          setWifiScanDialogOpen(true)
                        }}
                        disabled={!isApiConnected}
                        title="Scan for WiFi networks"
                      >
                        <Search className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleInterface(iface.id)}
                      disabled={isToggling === iface.id || !isApiConnected}
                    >
                      {isToggling === iface.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Settings className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">MAC:</span>
                    <span className="font-mono text-gray-900">{iface.mac || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Type:</span>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${
                        iface.type === "Static" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {iface.type}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Address:</span>
                    <span className="font-mono text-gray-900">{iface.address || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Netmask:</span>
                    <span className="font-mono text-gray-900">{iface.netmask || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Gateway:</span>
                    <span className="font-mono text-gray-900">{iface.gateway || "N/A"}</span>
                  </div>
                  {(iface.name && (iface.name.includes('wl') || iface.name.includes('wifi'))) && wifiStatus[iface.name] && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">WiFi SSID:</span>
                        <span className="font-mono text-gray-900">
                          {wifiStatus[iface.name].connected ? wifiStatus[iface.name].ssid : 'Not connected'}
                        </span>
                      </div>
                      {wifiStatus[iface.name].connected && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Signal:</span>
                          <span className="font-mono text-gray-900">{wifiStatus[iface.name].signal}dBm</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <InterfaceEditDialog interface={selectedInterface} open={editDialogOpen} onOpenChange={setEditDialogOpen} />
      </Dialog>

      {/* WiFi Scan Dialog */}
      <Dialog open={wifiScanDialogOpen} onOpenChange={setWifiScanDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-blue-600 flex items-center gap-2">
              <Wifi className="w-5 h-5" />
              WiFi Networks - {selectedWifiInterface}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Available WiFi networks on interface {selectedWifiInterface}
              </p>
              <Button
                onClick={async () => {
                  try {
                    setIsScanning(true)
                    await onScanWifiNetworks(selectedWifiInterface)
                  } catch (error) {
                    console.error('WiFi scan failed:', error)
                  } finally {
                    setIsScanning(false)
                  }
                }}
                disabled={!isApiConnected || isScanning}
                size="sm"
              >
                {isScanning ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                {isScanning ? 'Scanning...' : 'Scan Networks'}
              </Button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {wifiNetworks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <WifiOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <div>No WiFi networks found</div>
                  <div className="text-sm">Click "Scan Networks" to search for available networks</div>
                </div>
              ) : (
                wifiNetworks.map((network, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                      network.isConnected ? 'border-green-400 bg-green-50' : 'border-gray-200'
                    }`}
                    onClick={() => {
                      setSelectedWifiNetwork(network)
                      setWifiConnectDialogOpen(true)
                      setWifiPassword('')
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {network.isSecure ? (
                          <Lock className="w-4 h-4 text-gray-600" />
                        ) : (
                          <Unlock className="w-4 h-4 text-gray-400" />
                        )}
                        <Wifi className={`w-4 h-4 ${network.isConnected ? 'text-green-600' : 'text-gray-600'}`} />
                      </div>
                      <div>
                        <div className="font-medium">{network.ssid}</div>
                        <div className="text-sm text-gray-500">
                          {network.security} • Channel {network.channel}
                          {network.isConnected && <span className="text-green-600 font-medium"> • Connected</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Signal className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{network.signal}dBm</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* WiFi Connection Dialog */}
      <Dialog open={wifiConnectDialogOpen} onOpenChange={setWifiConnectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-blue-600 flex items-center gap-2">
              <Wifi className="w-5 h-5" />
              Connect to {selectedWifiNetwork?.ssid}
            </DialogTitle>
          </DialogHeader>

          {selectedWifiNetwork && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{selectedWifiNetwork.ssid}</div>
                    <div className="text-sm text-gray-600">
                      {selectedWifiNetwork.security} • Signal: {selectedWifiNetwork.signal}dBm
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {selectedWifiNetwork.isSecure ? (
                      <Lock className="w-4 h-4 text-gray-600" />
                    ) : (
                      <Unlock className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {selectedWifiNetwork.isConnected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-green-700">Currently connected to this network</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          setIsDisconnecting(true)
                          await onDisconnectWifiNetwork(selectedWifiInterface)
                          setWifiConnectDialogOpen(false)
                          await onScanWifiNetworks(selectedWifiInterface)
                        } catch (error) {
                          console.error('Disconnect failed:', error)
                        } finally {
                          setIsDisconnecting(false)
                        }
                      }}
                      disabled={isDisconnecting}
                      className="flex-1"
                    >
                      {isDisconnecting ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <WifiOff className="w-4 h-4 mr-2" />
                      )}
                      Disconnect
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          await onForgetWifiNetwork(selectedWifiNetwork.ssid)
                          setWifiConnectDialogOpen(false)
                          await onScanWifiNetworks(selectedWifiInterface)
                        } catch (error) {
                          console.error('Forget network failed:', error)
                        }
                      }}
                      className="flex-1"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Forget
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedWifiNetwork.isSecure && (
                    <div>
                      <Label htmlFor="wifi-password">Password</Label>
                      <Input
                        id="wifi-password"
                        type="password"
                        value={wifiPassword}
                        onChange={(e) => setWifiPassword(e.target.value)}
                        placeholder="Enter WiFi password"
                        disabled={isConnecting}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setWifiConnectDialogOpen(false)}
                      disabled={isConnecting}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={async () => {
                        try {
                          setIsConnecting(true)
                          await onConnectToWifiNetwork(selectedWifiInterface, {
                            ssid: selectedWifiNetwork.ssid,
                            password: selectedWifiNetwork.isSecure ? wifiPassword : undefined,
                          })
                          setWifiConnectDialogOpen(false)
                          await onScanWifiNetworks(selectedWifiInterface)
                        } catch (error) {
                          console.error('Connection failed:', error)
                        } finally {
                          setIsConnecting(false)
                        }
                      }}
                      disabled={isConnecting || (selectedWifiNetwork.isSecure && !wifiPassword)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      {isConnecting ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Wifi className="w-4 h-4 mr-2" />
                      )}
                      Connect
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
} 