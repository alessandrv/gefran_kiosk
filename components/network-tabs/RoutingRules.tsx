"use client"

import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import {
  Plus,
  Save,
  Trash2,
  RefreshCw,
} from "lucide-react"
import { RoutingRule, NewRoutingRule, NetworkInterface } from "@/lib/api"
import { ValidatedInput } from "@/components/ui/validated-input"

interface RoutingRulesProps {
  routingRules: RoutingRule[]
  interfaces: NetworkInterface[]
  isApiConnected: boolean
  isLoading: boolean
  onAddRoute: (route: NewRoutingRule) => void
  onDeleteRoute: (id: string) => void
}

export default function RoutingRules({
  routingRules,
  interfaces,
  isApiConnected,
  isLoading,
  onAddRoute,
  onDeleteRoute,
}: RoutingRulesProps) {
  const [addRouteDialogOpen, setAddRouteDialogOpen] = useState(false)
  const [isAddingRoute, setIsAddingRoute] = useState(false)

  const handleDeleteRoute = async (id: string) => {
    try {
      await onDeleteRoute(id)
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
        await onAddRoute(formData)
        onOpenChange(false)
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

  return (
    <>
      <div className="flex justify-between items-center mb-4">
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
    </>
  )
} 