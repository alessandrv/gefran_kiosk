"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  ChevronDown,
  User,
  Settings,
  Network,
  Edit,
  Plus,
  Save,
  Trash2,
  Router,
  Globe,
  Shield,
  Activity,
  RefreshCw,
  Wifi,
  Cable,
  AlertCircle,
  CheckCircle,
} from "lucide-react"
import { useNetworkData } from "@/hooks/useNetworkData"
import { NetworkInterface, RoutingRule, NewRoutingRule } from "@/lib/api"

export default function NetworkSettingsLive() {
  const {
    interfaces,
    routingRules,
    dnsSettings,
    networkStats,
    isLoading,
    isApiConnected,
    error,
    refreshAll,
    toggleInterface,
    updateInterface,
    addRoute,
    deleteRoute,
    updateDNSSettings,
    runPingTest,
    runTraceroute,
    fetchNetworkStats,
  } = useNetworkData()

  const [activeSection, setActiveSection] = useState("Network Interfaces")
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedInterface, setSelectedInterface] = useState<NetworkInterface | null>(null)
  const [isToggling, setIsToggling] = useState<string | null>(null)
  const [addRouteDialogOpen, setAddRouteDialogOpen] = useState(false)
  const [isAddingRoute, setIsAddingRoute] = useState(false)
  
  // DNS settings state
  const [dnsFormData, setDnsFormData] = useState({
    primary: '',
    secondary: '',
    searchDomain: ''
  })
  const [isUpdatingDNS, setIsUpdatingDNS] = useState(false)
  
  // Diagnostics state
  const [pingTarget, setPingTarget] = useState('8.8.8.8')
  const [pingResult, setPingResult] = useState<any>(null)
  const [isPinging, setIsPinging] = useState(false)
  const [tracerouteTarget, setTracerouteTarget] = useState('8.8.8.8')
  const [tracerouteResult, setTracerouteResult] = useState<any>(null)
  const [isTracerouting, setIsTracerouting] = useState(false)

  // Update DNS form when settings are loaded
  React.useEffect(() => {
    if (dnsSettings) {
      setDnsFormData({
        primary: dnsSettings.global.primary || '',
        secondary: dnsSettings.global.secondary || '',
        searchDomain: dnsSettings.global.searchDomains.join(', ') || ''
      })
    }
  }, [dnsSettings])

  // Network-focused menu items only
  const menuItems = [
    { name: "Network Interfaces", icon: Network },
    { name: "Routing Rules", icon: Router },
    { name: "DNS Settings", icon: Globe },
    { name: "Security Settings", icon: Shield },
    { name: "Network Diagnostics", icon: Activity },
    { name: "General Settings", icon: Settings },
  ]

  const handleToggleInterface = async (id: string) => {
    setIsToggling(id)
    try {
      await toggleInterface(id)
    } catch (error) {
      console.error('Failed to toggle interface:', error)
    } finally {
      setIsToggling(null)
    }
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
    const [isUpdating, setIsUpdating] = useState(false)

    // Reset form data when dialog opens with new interface data
    React.useEffect(() => {
      if (open && iface) {
        // Get interface-specific DNS from dnsSettings if available
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
        setIsUpdating(true)
        if (formData.type === "DHCP") {
          // For DHCP, send empty values to clear static configuration
          await updateInterface(formData.id, {
            address: "",
            netmask: "",
            gateway: "",
            dns1: "",
            dns2: "",
          })
        } else {
          // For Static, send the configured values
          await updateInterface(formData.id, {
            address: formData.address,
            netmask: formData.netmask,
            gateway: formData.gateway,
            dns1: formData.dns1,
            dns2: formData.dns2,
          })
        }
        // Refresh DNS settings after interface update to reflect changes
        await refreshAll()
        onOpenChange(false)
      } catch (error) {
        console.error('Failed to update interface:', error)
      } finally {
        setIsUpdating(false)
      }
    }

    const handleCancel = () => {
      onOpenChange(false)
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
                />
              </div>
              <div>
                <Label htmlFor="mac">MAC Address</Label>
                <Input
                  id="mac"
                  value={formData.mac}
                  disabled
                  className="bg-gray-50"
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
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                      placeholder="192.168.1.100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="netmask">Netmask</Label>
                    <Input
                      id="netmask"
                      value={formData.netmask}
                      onChange={(e) => setFormData((prev) => ({ ...prev, netmask: e.target.value }))}
                      placeholder="255.255.255.0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="gateway">Default Gateway</Label>
                    <Input
                      id="gateway"
                      value={formData.gateway}
                      onChange={(e) => setFormData((prev) => ({ ...prev, gateway: e.target.value }))}
                      placeholder="192.168.1.1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="secondary">Secondary Address</Label>
                    <Input
                      id="secondary"
                      value={formData.secondaryAddress}
                      onChange={(e) => setFormData((prev) => ({ ...prev, secondaryAddress: e.target.value }))}
                      placeholder="192.168.1.101"
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
                <Input
                  id="dns1"
                  value={formData.dns1}
                  onChange={(e) => setFormData((prev) => ({ ...prev, dns1: e.target.value }))}
                  placeholder="8.8.8.8 (leave empty for global DNS)"
                />
              </div>
              <div>
                <Label htmlFor="dns2">Secondary DNS (Interface)</Label>
                <Input
                  id="dns2"
                  value={formData.dns2}
                  onChange={(e) => setFormData((prev) => ({ ...prev, dns2: e.target.value }))}
                  placeholder="8.8.4.4 (leave empty for global DNS)"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleCancel} disabled={isUpdating}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700" disabled={isUpdating}>
            {isUpdating ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {isUpdating ? 'Updating...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    )
  }

  const handleEditInterface = (iface: NetworkInterface) => {
    setSelectedInterface(iface)
    setEditDialogOpen(true)
  }

  const handleDeleteRoute = async (id: string) => {
    try {
      await deleteRoute(id)
    } catch (error) {
      console.error('Failed to delete route:', error)
    }
  }

  const RouteDialog = ({
    open,
    onOpenChange,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
  }) => {
    const [formData, setFormData] = useState<NewRoutingRule>({
      destination: "",
      gateway: "",
      interface: "",
      metric: 100,
    })

    const handleSave = async () => {
      try {
        setIsAddingRoute(true)
        await addRoute(formData)
        onOpenChange(false)
        // Reset form
        setFormData({
          destination: "",
          gateway: "",
          interface: "",
          metric: 100,
        })
      } catch (error) {
        console.error('Failed to add route:', error)
      } finally {
        setIsAddingRoute(false)
      }
    }

    const handleCancel = () => {
      onOpenChange(false)
      // Reset form
      setFormData({
        destination: "",
        gateway: "",
        interface: "",
        metric: 100,
      })
    }

    return (
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-blue-600">Add Routing Rule</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="destination">Destination Network</Label>
            <Input
              id="destination"
              value={formData.destination}
              onChange={(e) => setFormData((prev) => ({ ...prev, destination: e.target.value }))}
              placeholder="0.0.0.0/0 or 192.168.1.0/24"
            />
          </div>

          <div>
            <Label htmlFor="gateway">Gateway (optional)</Label>
            <Input
              id="gateway"
              value={formData.gateway}
              onChange={(e) => setFormData((prev) => ({ ...prev, gateway: e.target.value }))}
              placeholder="192.168.1.1"
            />
          </div>

          <div>
            <Label htmlFor="interface">Interface</Label>
            <Select
              value={formData.interface}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, interface: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select interface" />
              </SelectTrigger>
              <SelectContent>
                {interfaces.map((iface) => (
                  <SelectItem key={iface.id} value={iface.name}>
                    {iface.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="metric">Metric</Label>
            <Input
              id="metric"
              type="number"
              value={formData.metric}
              onChange={(e) => setFormData((prev) => ({ ...prev, metric: Number.parseInt(e.target.value) || 100 }))}
              placeholder="100"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleCancel} disabled={isAddingRoute}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700" disabled={isAddingRoute}>
            {isAddingRoute ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Add Route
          </Button>
        </div>
      </DialogContent>
    )
  }

  const renderConnectionStatus = () => (
    <div className="flex items-center gap-2 mb-4">
      {isApiConnected ? (
        <>
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-sm text-green-700">Connected to system</span>
        </>
      ) : (
        <>
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700">System connection failed</span>
        </>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={refreshAll}
        disabled={isLoading}
        className="ml-auto"
      >
        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
    </div>
  )

  const renderNetworkInterfaces = () => {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Network Interfaces</h2>
        </div>

        {renderConnectionStatus()}

        {error && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading && interfaces.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Loading network interfaces...</span>
          </div>
        ) : (
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <InterfaceEditDialog interface={selectedInterface} open={editDialogOpen} onOpenChange={setEditDialogOpen} />
        </Dialog>
      </div>
    )
  }

  const renderRoutingRules = () => {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Routing Rules</h2>
          <Dialog open={addRouteDialogOpen} onOpenChange={setAddRouteDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700" disabled={!isApiConnected}>
                <Plus className="w-4 h-4 mr-2" />
                Add Route
              </Button>
            </DialogTrigger>
            <RouteDialog open={addRouteDialogOpen} onOpenChange={setAddRouteDialogOpen} />
          </Dialog>
        </div>

        {renderConnectionStatus()}

        <Card className="bg-white">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-blue-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-900">Destination</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-900">Gateway</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-900">Interface</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-900">Metric</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-900">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {routingRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-sm">{rule.destination}</td>
                      <td className="px-4 py-3 font-mono text-sm">{rule.gateway || "Direct"}</td>
                      <td className="px-4 py-3 text-sm">{rule.interface}</td>
                      <td className="px-4 py-3 text-sm">{rule.metric}</td>
                      <td className="px-4 py-3">
                        <Badge className={rule.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                          {rule.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" disabled={!isApiConnected}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Routing Rule</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the routing rule for "{rule.destination}"? This may
                                affect network routing.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteRoute(rule.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderDNSSettings = () => {
    const handleUpdateDNS = async () => {
      try {
        setIsUpdatingDNS(true)
        const searchDomains = dnsFormData.searchDomain
          .split(',')
          .map(domain => domain.trim())
          .filter(Boolean)
        
        await updateDNSSettings(dnsFormData.primary, dnsFormData.secondary, searchDomains)
        
        // Show success feedback
        console.log('DNS settings updated successfully')
      } catch (error) {
        console.error('Failed to update DNS settings:', error)
      } finally {
        setIsUpdatingDNS(false)
      }
    }

    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">DNS Settings</h2>
        {renderConnectionStatus()}

        {error && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading && !dnsSettings ? (
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Loading DNS settings...</span>
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-blue-600">Global DNS Configuration</CardTitle>
                <p className="text-sm text-gray-600 mt-2">
                  These settings apply system-wide to all interfaces that don't have specific DNS configured.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="global-dns1">Primary DNS Server</Label>
                    <Input
                      id="global-dns1"
                      value={dnsFormData.primary}
                      onChange={(e) => setDnsFormData(prev => ({ ...prev, primary: e.target.value }))}
                      placeholder="8.8.8.8"
                      disabled={!isApiConnected}
                    />
                  </div>
                  <div>
                    <Label htmlFor="global-dns2">Secondary DNS Server</Label>
                    <Input
                      id="global-dns2"
                      value={dnsFormData.secondary}
                      onChange={(e) => setDnsFormData(prev => ({ ...prev, secondary: e.target.value }))}
                      placeholder="8.8.4.4"
                      disabled={!isApiConnected}
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
                    disabled={!isApiConnected}
                  />
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
                    Apply Global DNS Settings
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
                    {Object.entries(dnsSettings.interfaces).map(([interfaceName, dns]) => (
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
                              handleEditInterface(interfaceToEdit)
                            }
                          }}
                          disabled={!isApiConnected}
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
        )}
      </div>
    )
  }

  const renderSecuritySettings = () => (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Security Settings</h2>
      {renderConnectionStatus()}
      <div className="space-y-6">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-blue-600">Firewall Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Enable Firewall</Label>
                <p className="text-xs text-gray-500 mt-1">Protect the system with firewall rules</p>
              </div>
              <Button variant="outline" size="sm" disabled={!isApiConnected}>
                Configure
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderNetworkDiagnostics = () => {
    const handlePingTest = async () => {
      try {
        setIsPinging(true)
        const result = await runPingTest(pingTarget, 4)
        setPingResult(result)
      } catch (error: unknown) {
        console.error('Ping test failed:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        setPingResult({
          target: pingTarget,
          success: false,
          error: errorMessage,
          output: `Error: ${errorMessage}`
        })
      } finally {
        setIsPinging(false)
      }
    }

    const handleTraceroute = async () => {
      try {
        setIsTracerouting(true)
        const result = await runTraceroute(tracerouteTarget, 15)
        setTracerouteResult(result)
      } catch (error: unknown) {
        console.error('Traceroute failed:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        setTracerouteResult({
          target: tracerouteTarget,
          success: false,
          error: errorMessage,
          output: `Error: ${errorMessage}`
        })
      } finally {
        setIsTracerouting(false)
      }
    }

    const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Network Diagnostics</h2>
        {renderConnectionStatus()}

        <div className="space-y-6">
          {/* Connectivity Tests */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-blue-600">Connectivity Tests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Ping Test */}
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor="ping-target">Ping Target</Label>
                    <Input
                      id="ping-target"
                      value={pingTarget}
                      onChange={(e) => setPingTarget(e.target.value)}
                      placeholder="8.8.8.8 or google.com"
                      disabled={!isApiConnected}
                    />
                  </div>
                  <Button
                    onClick={handlePingTest}
                    disabled={!isApiConnected || isPinging}
                    className="mt-6"
                  >
                    {isPinging ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Activity className="w-4 h-4 mr-2" />
                    )}
                    Ping Test
                  </Button>
                </div>

                {pingResult && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      {pingResult.success ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      )}
                      <span className="font-medium">
                        Ping to {pingResult.target} - {pingResult.success ? 'Success' : 'Failed'}
                      </span>
                    </div>
                    
                    {pingResult.success && pingResult.packets && (
                      <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                        <div>
                          <span className="text-gray-600">Packets:</span>
                          <div>{pingResult.packets.transmitted} sent, {pingResult.packets.received} received</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Loss:</span>
                          <div className={pingResult.packets.loss > 0 ? 'text-red-600' : 'text-green-600'}>
                            {pingResult.packets.loss}%
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600">Avg Time:</span>
                          <div>{pingResult.timing?.avg?.toFixed(2) || 'N/A'} ms</div>
                        </div>
                      </div>
                    )}
                    
                    <details className="text-sm">
                      <summary className="cursor-pointer text-blue-600">Show full output</summary>
                      <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                        {pingResult.output}
                      </pre>
                    </details>
                  </div>
                )}
              </div>

              {/* Traceroute Test */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor="traceroute-target">Traceroute Target</Label>
                    <Input
                      id="traceroute-target"
                      value={tracerouteTarget}
                      onChange={(e) => setTracerouteTarget(e.target.value)}
                      placeholder="8.8.8.8 or google.com"
                      disabled={!isApiConnected}
                    />
                  </div>
                  <Button
                    onClick={handleTraceroute}
                    disabled={!isApiConnected || isTracerouting}
                    className="mt-6"
                  >
                    {isTracerouting ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Router className="w-4 h-4 mr-2" />
                    )}
                    Traceroute
                  </Button>
                </div>

                {tracerouteResult && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      {tracerouteResult.success ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      )}
                      <span className="font-medium">
                        Traceroute to {tracerouteResult.target} - {tracerouteResult.success ? 'Success' : 'Failed'}
                      </span>
                    </div>
                    
                    {tracerouteResult.success && tracerouteResult.hops && (
                      <div className="mb-3">
                        <span className="text-sm text-gray-600">Route ({tracerouteResult.hops.length} hops):</span>
                        <div className="mt-2 space-y-1 text-sm">
                          {tracerouteResult.hops.slice(0, 5).map((hop: { hop: number; details: string }) => (
                            <div key={hop.hop} className="font-mono">
                              {hop.hop}. {hop.details}
                            </div>
                          ))}
                          {tracerouteResult.hops.length > 5 && (
                            <div className="text-gray-500">... and {tracerouteResult.hops.length - 5} more hops</div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <details className="text-sm">
                      <summary className="cursor-pointer text-blue-600">Show full output</summary>
                      <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                        {tracerouteResult.output}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Network Statistics */}
          <Card className="bg-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-blue-600">Network Statistics</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchNetworkStats}
                  disabled={!isApiConnected}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {networkStats ? (
                <div className="space-y-4">
                  {/* Interface Statistics */}
                  <div>
                    <h4 className="font-medium mb-3">Interface Statistics</h4>
                    <div className="grid gap-4">
                      {Object.entries(networkStats.interfaces).map(([interfaceName, stats]) => (
                        <div key={interfaceName} className="p-3 bg-gray-50 rounded">
                          <div className="font-medium mb-2">{interfaceName}</div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">RX:</span>
                              <div>Bytes: {formatBytes(stats.rx.bytes)}</div>
                              <div>Packets: {stats.rx.packets.toLocaleString()}</div>
                              <div className="text-red-600">Errors: {stats.rx.errors}</div>
                            </div>
                            <div>
                              <span className="text-gray-600">TX:</span>
                              <div>Bytes: {formatBytes(stats.tx.bytes)}</div>
                              <div>Packets: {stats.tx.packets.toLocaleString()}</div>
                              <div className="text-red-600">Errors: {stats.tx.errors}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Connection Statistics */}
                  <div>
                    <h4 className="font-medium mb-3">Connection Statistics</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="p-3 bg-blue-50 rounded text-center">
                        <div className="text-2xl font-bold text-blue-600">{networkStats.connections.tcp}</div>
                        <div className="text-gray-600">TCP Connections</div>
                      </div>
                      <div className="p-3 bg-green-50 rounded text-center">
                        <div className="text-2xl font-bold text-green-600">{networkStats.connections.udp}</div>
                        <div className="text-gray-600">UDP Connections</div>
                      </div>
                      <div className="p-3 bg-purple-50 rounded text-center">
                        <div className="text-2xl font-bold text-purple-600">{networkStats.connections.listening}</div>
                        <div className="text-gray-600">Listening Ports</div>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    Last updated: {new Date(networkStats.timestamp).toLocaleString()}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <div>Click refresh to load network statistics</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const renderGeneralSettings = () => (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">General Settings</h2>
      {renderConnectionStatus()}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-blue-600">System Network Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="hostname">Hostname</Label>
            <Input id="hostname" defaultValue="gefran-device" />
          </div>
          <div>
            <Label htmlFor="domain">Domain</Label>
            <Input id="domain" placeholder="local.domain" />
          </div>
          <div className="flex justify-end">
            <Button className="bg-blue-600 hover:bg-blue-700" disabled={!isApiConnected}>
              <Save className="w-4 h-4 mr-2" />
              Apply Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderContent = () => {
    switch (activeSection) {
      case "Network Interfaces":
        return renderNetworkInterfaces()
      case "Routing Rules":
        return renderRoutingRules()
      case "DNS Settings":
        return renderDNSSettings()
      case "Security Settings":
        return renderSecuritySettings()
      case "Network Diagnostics":
        return renderNetworkDiagnostics()
      case "General Settings":
        return renderGeneralSettings()
      default:
        return renderNetworkInterfaces()
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-blue-600 text-white">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <div className="text-xl font-bold">GEFRAN</div>
            <div className="text-sm opacity-90">NETWORK</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="text-sm">Admin</span>
            </div>
            <Button variant="ghost" size="sm" className="text-white hover:bg-blue-700">
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Left Sidebar */}
        <div className="w-64 bg-blue-600 text-white min-h-screen">
          <div className="p-4">
            <nav className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon
                const isActive = item.name === activeSection
                return (
                  <button
                    key={item.name}
                    onClick={() => setActiveSection(item.name)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded transition-colors ${
                      isActive ? "bg-blue-700 text-white" : "text-blue-100 hover:bg-blue-700 hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {/* Content Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-gray-900">{activeSection}</h1>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isApiConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </div>
            </div>
          </div>

          {/* Dynamic Content */}
          {renderContent()}
        </div>
      </div>
    </div>
  )
} 