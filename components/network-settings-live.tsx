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
import { ValidatedInput } from "@/components/ui/validated-input"

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
    firewallStatus,
    enableFirewall,
    disableFirewall,
    resetFirewall,
    setFirewallDefaultPolicy,
    addFirewallRule,
    deleteFirewallRule,
  } = useNetworkData()

  const [activeSection, setActiveSection] = useState("Network Interfaces")
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedInterface, setSelectedInterface] = useState<NetworkInterface | null>(null)
  const [isToggling, setIsToggling] = useState<string | null>(null)
  const [addRouteDialogOpen, setAddRouteDialogOpen] = useState(false)
  const [isAddingRoute, setIsAddingRoute] = useState(false)
  const [isUpdatingInterface, setIsUpdatingInterface] = useState(false)
  
  // DNS settings state
  const [dnsFormData, setDnsFormData] = useState({
    primary: '',
    secondary: '',
    searchDomain: ''
  })
  const [isUpdatingDNS, setIsUpdatingDNS] = useState(false)
  
  // Diagnostics state
  const [pingTarget, setPingTarget] = useState('google.com')
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
        setIsUpdatingInterface(true)
        if (formData.type === "DHCP") {
          // For DHCP, only clear static IP configuration but preserve DNS settings
          await updateInterface(formData.id, {
            address: "",
            netmask: "",
            gateway: "",
            dns1: formData.dns1, // Preserve DNS settings
            dns2: formData.dns2, // Preserve DNS settings
          })
        } else {
          // For Static, send all configured values including DNS
          await updateInterface(formData.id, {
            address: formData.address,
            netmask: formData.netmask,
            gateway: formData.gateway,
            dns1: formData.dns1,
            dns2: formData.dns2,
          })
        }
        // Only close modal on successful update
        onOpenChange(false)
      } catch (error) {
        console.error('Failed to update interface:', error)
        // Don't close modal on error so user can see what happened and retry
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
            <ValidatedInput
              id="destination"
              value={formData.destination}
              onChange={(e) => setFormData((prev) => ({ ...prev, destination: e.target.value }))}
              placeholder="0.0.0.0/0 or 192.168.1.0/24"
              validationType="text"
              enableKeyboard={true}
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter destination network in CIDR notation (e.g., 192.168.1.0/24 or 0.0.0.0/0 for default route)
            </p>
          </div>

          <div>
            <Label htmlFor="gateway">Gateway (optional)</Label>
            <ValidatedInput
              id="gateway"
              value={formData.gateway ?? ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, gateway: e.target.value || undefined }))}
              placeholder="192.168.1.1"
              validationType="ip"
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
            <ValidatedInput
              id="metric"
              type="number"
              value={(formData.metric ?? 100).toString()}
              onChange={(e) => setFormData((prev) => ({ ...prev, metric: Number.parseInt(e.target.value) || 100 }))}
              placeholder="100"
              validationType="number"
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

  const FirewallRuleForm = () => {
    const [formData, setFormData] = useState({
      action: 'allow' as 'allow' | 'deny' | 'reject',
      direction: 'in' as 'in' | 'out',
      port: '',
      protocol: 'tcp' as 'tcp' | 'udp',
      from: '',
      comment: ''
    })
    const [isAdding, setIsAdding] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      try {
        setIsAdding(true)
        await addFirewallRule({
          action: formData.action,
          direction: formData.direction,
          port: formData.port || undefined,
          protocol: formData.protocol,
          from: formData.from || undefined,
          comment: formData.comment || undefined
        })
        // Reset form
        setFormData({
          action: 'allow',
          direction: 'in',
          port: '',
          protocol: 'tcp',
          from: '',
          comment: ''
        })
      } catch (error) {
        console.error('Failed to add firewall rule:', error)
      } finally {
        setIsAdding(false)
      }
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="action">Action</Label>
            <Select
              value={formData.action}
              onValueChange={(value: 'allow' | 'deny' | 'reject') => 
                setFormData(prev => ({ ...prev, action: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="allow">Allow</SelectItem>
                <SelectItem value="deny">Deny</SelectItem>
                <SelectItem value="reject">Reject</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="direction">Direction</Label>
            <Select
              value={formData.direction}
              onValueChange={(value: 'in' | 'out') => 
                setFormData(prev => ({ ...prev, direction: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">Incoming</SelectItem>
                <SelectItem value="out">Outgoing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="port">Port</Label>
            <ValidatedInput
              id="port"
              value={formData.port}
              onChange={(e) => setFormData(prev => ({ ...prev, port: e.target.value }))}
              placeholder="22, 80, 443, 8080-8090"
              validationType="text"
            />
            <p className="text-xs text-gray-500 mt-1">
              Single port, range (8080-8090), or service name
            </p>
          </div>
          <div>
            <Label htmlFor="protocol">Protocol</Label>
            <Select
              value={formData.protocol}
              onValueChange={(value: 'tcp' | 'udp') => 
                setFormData(prev => ({ ...prev, protocol: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tcp">TCP</SelectItem>
                <SelectItem value="udp">UDP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="from">From (Source)</Label>
          <ValidatedInput
            id="from"
            value={formData.from}
            onChange={(e) => setFormData(prev => ({ ...prev, from: e.target.value }))}
            placeholder="192.168.1.0/24, 10.0.0.0/8, or any"
            validationType="text"
          />
          <p className="text-xs text-gray-500 mt-1">
            IP address, CIDR block, or leave empty for any
          </p>
        </div>

        <div>
          <Label htmlFor="comment">Comment (optional)</Label>
          <Input
            id="comment"
            value={formData.comment}
            onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
            placeholder="Description for this rule"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="submit" disabled={isAdding || !formData.action}>
            {isAdding ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Add Rule
          </Button>
        </div>
      </form>
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
                          disabled={!isApiConnected || isUpdatingInterface}
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
      
      {isLoading && !firewallStatus ? (
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Loading firewall settings...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Firewall Status */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-blue-600 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                UFW Firewall Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {firewallStatus ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${firewallStatus.enabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="font-medium">
                        Firewall {firewallStatus.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={firewallStatus.enabled ? "destructive" : "default"}
                        size="sm"
                        onClick={firewallStatus.enabled ? disableFirewall : enableFirewall}
                        disabled={!isApiConnected}
                      >
                        {firewallStatus.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" disabled={!isApiConnected}>
                            Reset
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reset Firewall</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will reset the firewall to default settings and remove all custom rules. Are you sure?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={resetFirewall} className="bg-red-600 hover:bg-red-700">
                              Reset
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {/* Default Policies */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <Label className="text-sm font-medium">Incoming</Label>
                      <div className="mt-1">
                        <Select
                          value={firewallStatus.defaultIncoming}
                          onValueChange={(value) => setFirewallDefaultPolicy('incoming', value)}
                          disabled={!isApiConnected}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="allow">Allow</SelectItem>
                            <SelectItem value="deny">Deny</SelectItem>
                            <SelectItem value="reject">Reject</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="text-center">
                      <Label className="text-sm font-medium">Outgoing</Label>
                      <div className="mt-1">
                        <Select
                          value={firewallStatus.defaultOutgoing}
                          onValueChange={(value) => setFirewallDefaultPolicy('outgoing', value)}
                          disabled={!isApiConnected}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="allow">Allow</SelectItem>
                            <SelectItem value="deny">Deny</SelectItem>
                            <SelectItem value="reject">Reject</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="text-center">
                      <Label className="text-sm font-medium">Routed</Label>
                      <div className="mt-1">
                        <Select
                          value={firewallStatus.defaultRouted}
                          onValueChange={(value) => setFirewallDefaultPolicy('routed', value)}
                          disabled={!isApiConnected}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="allow">Allow</SelectItem>
                            <SelectItem value="deny">Deny</SelectItem>
                            <SelectItem value="reject">Reject</SelectItem>
                            <SelectItem value="disabled">Disabled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <div>Unable to load firewall status</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Firewall Rules */}
          {firewallStatus && (
            <Card className="bg-white">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-blue-600">Firewall Rules</CardTitle>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="bg-blue-600 hover:bg-blue-700" disabled={!isApiConnected}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Rule
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Firewall Rule</DialogTitle>
                      </DialogHeader>
                      <FirewallRuleForm />
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {firewallStatus.rules.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-blue-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-blue-900">#</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-blue-900">Port/Service</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-blue-900">Action</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-blue-900">Direction</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-blue-900">From</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-blue-900">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {firewallStatus.rules.map((rule) => (
                          <tr key={rule.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-mono">{rule.id}</td>
                            <td className="px-4 py-3 text-sm font-mono">{rule.port}</td>
                            <td className="px-4 py-3">
                              <Badge className={
                                rule.action === 'allow' ? 'bg-green-100 text-green-800' :
                                rule.action === 'deny' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }>
                                {rule.action.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm">{rule.direction.toUpperCase()}</td>
                            <td className="px-4 py-3 text-sm font-mono">{rule.from}</td>
                            <td className="px-4 py-3">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" disabled={!isApiConnected}>
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Firewall Rule</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete rule #{rule.id}? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteFirewallRule(parseInt(rule.id))}
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
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <div>No firewall rules configured</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
} 