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
} from "lucide-react"

interface NetworkInterface {
  id: string
  name: string
  mac: string
  type: "DHCP" | "Static"
  address: string
  secondaryAddress: string
  netmask: string
  gateway: string
  dns1: string
  dns2: string
  status: "active" | "inactive"
  enabled: boolean
}

interface RoutingRule {
  id: string
  destination: string
  gateway: string
  interface: string
  metric: number
  enabled: boolean
}

export default function GefranNetworkSettings() {
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([
    {
      id: "1",
      name: "eth0",
      mac: "00:00:00:39:70:16",
      type: "DHCP",
      address: "",
      secondaryAddress: "",
      netmask: "",
      gateway: "",
      dns1: "",
      dns2: "",
      status: "inactive",
      enabled: false,
    },
    {
      id: "2",
      name: "eth1",
      mac: "00:00:00:39:70:17",
      type: "Static",
      address: "",
      secondaryAddress: "",
      netmask: "",
      gateway: "",
      dns1: "8.8.8.8",
      dns2: "8.8.4.4",
      status: "active",
      enabled: true,
    },
    {
      id: "3",
      name: "eth2",
      mac: "9C:5A:CF:DE:CE:32",
      type: "Static",
      address: "192.168.100.237",
      secondaryAddress: "",
      netmask: "255.255.255.0",
      gateway: "",
      dns1: "",
      dns2: "",
      status: "inactive",
      enabled: false,
    },
    {
      id: "4",
      name: "eth3",
      mac: "00:00:00:39:70:39",
      type: "DHCP",
      address: "",
      secondaryAddress: "",
      netmask: "",
      gateway: "",
      dns1: "",
      dns2: "",
      status: "inactive",
      enabled: false,
    },
  ])

  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([
    {
      id: "1",
      destination: "0.0.0.0/0",
      gateway: "192.168.1.1",
      interface: "eth1",
      metric: 1,
      enabled: true,
    },
    {
      id: "2",
      destination: "10.0.0.0/8",
      gateway: "10.0.0.1",
      interface: "eth2",
      metric: 10,
      enabled: false,
    },
  ])

  const [activeSection, setActiveSection] = useState("Network Interfaces")
  const [editingInterface, setEditingInterface] = useState<NetworkInterface | null>(null)
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null)
  const [isAddingInterface, setIsAddingInterface] = useState(false)
  const [isAddingRule, setIsAddingRule] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedInterface, setSelectedInterface] = useState<NetworkInterface | null>(null)
  const [editRuleDialogOpen, setEditRuleDialogOpen] = useState(false)
  const [selectedRule, setSelectedRule] = useState<RoutingRule | null>(null)

  // Network-focused menu items only
  const menuItems = [
    { name: "Network Interfaces", icon: Network },
    { name: "Routing Rules", icon: Router },
    { name: "DNS Settings", icon: Globe },
    { name: "Security Settings", icon: Shield },
    { name: "Network Diagnostics", icon: Activity },
    { name: "General Settings", icon: Settings },
  ]

  const updateInterface = (updatedInterface: NetworkInterface) => {
    setInterfaces((prev) => prev.map((iface) => (iface.id === updatedInterface.id ? updatedInterface : iface)))
    setEditingInterface(null)
  }

  const addInterface = (newInterface: Omit<NetworkInterface, "id">) => {
    const id = (interfaces.length + 1).toString()
    setInterfaces((prev) => [...prev, { ...newInterface, id }])
    setIsAddingInterface(false)
  }

  const deleteInterface = (id: string) => {
    setInterfaces((prev) => prev.filter((iface) => iface.id !== id))
  }

  const updateRoutingRule = (updatedRule: RoutingRule) => {
    setRoutingRules((prev) => prev.map((rule) => (rule.id === updatedRule.id ? updatedRule : rule)))
    setEditingRule(null)
  }

  const addRoutingRule = (newRule: Omit<RoutingRule, "id">) => {
    const id = (routingRules.length + 1).toString()
    setRoutingRules((prev) => [...prev, { ...newRule, id }])
    setIsAddingRule(false)
  }

  const deleteRoutingRule = (id: string) => {
    setRoutingRules((prev) => prev.filter((rule) => rule.id !== id))
  }

  const InterfaceEditDialog = ({
    interface: iface,
    isNew = false,
    open,
    onOpenChange,
  }: {
    interface: NetworkInterface | null
    isNew?: boolean
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
        setFormData(iface)
      }
    }, [open, iface])

    const handleSave = () => {
      if (isNew) {
        addInterface(formData)
      } else {
        updateInterface(formData)
      }
      onOpenChange(false)
    }

    const handleCancel = () => {
      onOpenChange(false)
    }

    return (
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-blue-600">
            {isNew ? "Add Network Interface" : `Edit ${formData.name}`}
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
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="eth0"
                />
              </div>
              <div>
                <Label htmlFor="mac">MAC Address</Label>
                <Input
                  id="mac"
                  value={formData.mac}
                  onChange={(e) => setFormData((prev) => ({ ...prev, mac: e.target.value }))}
                  placeholder="00:00:00:00:00:00"
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dns1">Primary DNS</Label>
                <Input
                  id="dns1"
                  value={formData.dns1}
                  onChange={(e) => setFormData((prev) => ({ ...prev, dns1: e.target.value }))}
                  placeholder="8.8.8.8"
                />
              </div>
              <div>
                <Label htmlFor="dns2">Secondary DNS</Label>
                <Input
                  id="dns2"
                  value={formData.dns2}
                  onChange={(e) => setFormData((prev) => ({ ...prev, dns2: e.target.value }))}
                  placeholder="8.8.4.4"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>
      </DialogContent>
    )
  }

  const RoutingRuleDialog = ({
    rule,
    isNew = false,
    open,
    onOpenChange,
  }: {
    rule: RoutingRule | null
    isNew?: boolean
    open: boolean
    onOpenChange: (open: boolean) => void
  }) => {
    const [formData, setFormData] = useState<RoutingRule>(
      rule || {
        id: "",
        destination: "",
        gateway: "",
        interface: "",
        metric: 1,
        enabled: true,
      },
    )

    // Reset form data when dialog opens with new rule data
    React.useEffect(() => {
      if (open && rule) {
        setFormData(rule)
      }
    }, [open, rule])

    const handleSave = () => {
      if (isNew) {
        addRoutingRule(formData)
      } else {
        updateRoutingRule(formData)
      }
      onOpenChange(false)
    }

    const handleCancel = () => {
      onOpenChange(false)
    }

    return (
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-blue-600">{isNew ? "Add Routing Rule" : "Edit Routing Rule"}</DialogTitle>
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
            <Label htmlFor="gateway">Gateway</Label>
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
              onChange={(e) => setFormData((prev) => ({ ...prev, metric: Number.parseInt(e.target.value) || 1 }))}
              placeholder="1"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>
      </DialogContent>
    )
  }

  const handleEditInterface = (iface: NetworkInterface) => {
    setSelectedInterface(iface)
    setEditDialogOpen(true)
  }

  const handleEditRule = (rule: RoutingRule) => {
    setSelectedRule(rule)
    setEditRuleDialogOpen(true)
  }

  const renderNetworkInterfaces = () => {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Network Interfaces</h2>
          <Dialog open={isAddingInterface} onOpenChange={setIsAddingInterface}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Interface
              </Button>
            </DialogTrigger>
            <InterfaceEditDialog
              interface={null}
              isNew={true}
              open={isAddingInterface}
              onOpenChange={setIsAddingInterface}
            />
          </Dialog>
        </div>

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
                        <Network className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-semibold text-gray-900">{iface.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {iface.status === "active" && <div className="w-3 h-3 bg-green-500 rounded-full"></div>}
                      <Button variant="ghost" size="sm" onClick={() => handleEditInterface(iface)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Network Interface</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete interface "{iface.name}"? This action cannot be undone and
                              may disrupt network connectivity.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteInterface(iface.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">MAC:</span>
                      <span className="font-mono text-gray-900">{iface.mac}</span>
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
                      <span className="font-mono text-gray-900">{iface.address || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Netmask:</span>
                      <span className="font-mono text-gray-900">{iface.netmask || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Gateway:</span>
                      <span className="font-mono text-gray-900">{iface.gateway || "-"}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Single Edit Dialog */}
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
          <Dialog open={isAddingRule} onOpenChange={setIsAddingRule}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Rule
              </Button>
            </DialogTrigger>
            <RoutingRuleDialog rule={null} isNew={true} open={isAddingRule} onOpenChange={setIsAddingRule} />
          </Dialog>
        </div>

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
                      <td className="px-4 py-3 font-mono text-sm">{rule.gateway}</td>
                      <td className="px-4 py-3 text-sm">{rule.interface}</td>
                      <td className="px-4 py-3 text-sm">{rule.metric}</td>
                      <td className="px-4 py-3">
                        <Badge className={rule.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                          {rule.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEditRule(rule)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
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
                                  onClick={() => deleteRoutingRule(rule.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        {/* Single Edit Rule Dialog */}
        <Dialog open={editRuleDialogOpen} onOpenChange={setEditRuleDialogOpen}>
          <RoutingRuleDialog rule={selectedRule} open={editRuleDialogOpen} onOpenChange={setEditRuleDialogOpen} />
        </Dialog>
      </div>
    )
  }

  const renderDNSSettings = () => (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">DNS Settings</h2>

      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-blue-600">Global DNS Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="global-dns1">Primary DNS Server</Label>
              <Input id="global-dns1" defaultValue="8.8.8.8" />
            </div>
            <div>
              <Label htmlFor="global-dns2">Secondary DNS Server</Label>
              <Input id="global-dns2" defaultValue="8.8.4.4" />
            </div>
          </div>

          <div>
            <Label htmlFor="search-domain">Search Domain</Label>
            <Input id="search-domain" placeholder="example.com" />
          </div>

          <div className="flex justify-end">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              Apply DNS Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderSecuritySettings = () => (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Security Settings</h2>

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
              <Button variant="outline" size="sm">
                Configure
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-blue-600">Access Control</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">SSH Access</Label>
                <p className="text-xs text-gray-500 mt-1">Allow SSH connections</p>
              </div>
              <Button variant="outline" size="sm">
                Configure
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderNetworkDiagnostics = () => (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Network Diagnostics</h2>

      <div className="space-y-6">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-blue-600">Connectivity Tests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline">Ping Test</Button>
              <Button variant="outline">Traceroute</Button>
              <Button variant="outline">Port Scan</Button>
              <Button variant="outline">Speed Test</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-blue-600">Network Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600">Network monitoring and statistics will be displayed here.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderGeneralSettings = () => (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">General Settings</h2>

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
            <Button className="bg-blue-600 hover:bg-blue-700">
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
        {/* Left Sidebar - Network focused */}
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

        {/* Main Content - Full width now */}
        <div className="flex-1">
          {/* Content Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-gray-900">{activeSection}</h1>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
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
