"use client"

import React, { useState, useEffect } from "react"
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
import {
  Shield,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  X,
} from "lucide-react"
import { ValidatedInput } from "@/components/ui/validated-input"
import toast from 'react-hot-toast'

interface SecuritySettingsProps {
  firewallStatus: any
  isApiConnected: boolean
  isLoading: boolean
  onEnableFirewall: () => void
  onDisableFirewall: () => void
  onResetFirewall: () => void
  onSetFirewallDefaultPolicy: (direction: string, policy: string) => void
  onAddFirewallRule: (rule: any) => void
  onDeleteFirewallRule: (id: number) => void
}

export default function SecuritySettings({
  firewallStatus,
  isApiConnected,
  isLoading,
  onEnableFirewall,
  onDisableFirewall,
  onResetFirewall,
  onSetFirewallDefaultPolicy,
  onAddFirewallRule,
  onDeleteFirewallRule,
}: SecuritySettingsProps) {
  const [addFirewallRuleDialogOpen, setAddFirewallRuleDialogOpen] = useState(false)
  const [isChangingIncomingPolicy, setIsChangingIncomingPolicy] = useState(false)
  const [isChangingOutgoingPolicy, setIsChangingOutgoingPolicy] = useState(false)
  const [isSettingPolicy, setIsSettingPolicy] = useState(false)
  const [isAddingRule, setIsAddingRule] = useState(false)
  const [newRule, setNewRule] = useState({
    port: '',
    protocol: '',
    action: '',
    source: ''
  })

  const handleIncomingPolicyChange = async (policy: string) => {
    try {
      setIsChangingIncomingPolicy(true)
      await onSetFirewallDefaultPolicy('incoming', policy)
      toast.success(`Incoming policy set to ${policy.toUpperCase()}`)
    } catch (error: any) {
      console.error('Failed to change incoming policy:', error)
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to update incoming policy'
      toast.error(`Policy Update Failed: ${errorMessage}`)
    } finally {
      setIsChangingIncomingPolicy(false)
    }
  }

  const handleOutgoingPolicyChange = async (policy: string) => {
    try {
      setIsChangingOutgoingPolicy(true)
      await onSetFirewallDefaultPolicy('outgoing', policy)
      toast.success(`Outgoing policy set to ${policy.toUpperCase()}`)
    } catch (error: any) {
      console.error('Failed to change outgoing policy:', error)
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to update outgoing policy'
      toast.error(`Policy Update Failed: ${errorMessage}`)
    } finally {
      setIsChangingOutgoingPolicy(false)
    }
  }

  const handleSetFirewallPolicy = async (policy: 'ACCEPT' | 'DROP') => {
    try {
      setIsSettingPolicy(true)
      await onSetFirewallDefaultPolicy('incoming', policy)
      toast.success(`Firewall default policy set to ${policy}`)
    } catch (error: any) {
      console.error('Failed to set firewall policy:', error)
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to set firewall policy'
      toast.error(`Policy Update Failed: ${errorMessage}`)
    } finally {
      setIsSettingPolicy(false)
    }
  }

  const handleAddFirewallRule = async () => {
    if (!newRule.port || !newRule.protocol || !newRule.action) {
      toast.error('Please fill in all required fields')
      return
    }

    const port = parseInt(newRule.port)
    if (isNaN(port) || port < 1 || port > 65535) {
      toast.error('Port must be a number between 1 and 65535')
      return
    }

    try {
      setIsAddingRule(true)
      await onAddFirewallRule({
        port: port,
        protocol: newRule.protocol as 'tcp' | 'udp',
        action: newRule.action as 'ACCEPT' | 'DROP',
        source: newRule.source || undefined
      })
      setNewRule({ port: '', protocol: '', action: '', source: '' })
      toast.success('Firewall rule added successfully')
    } catch (error: any) {
      console.error('Failed to add firewall rule:', error)
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to add firewall rule'
      toast.error(`Add Rule Failed: ${errorMessage}`)
    } finally {
      setIsAddingRule(false)
    }
  }

  const FirewallRuleForm = ({ onSuccess }: { onSuccess?: () => void }) => {
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
        await onAddFirewallRule({
          action: formData.action,
          direction: formData.direction,
          port: formData.port || undefined,
          protocol: formData.protocol,
          from: formData.from || undefined,
          comment: formData.comment || undefined
        })
        setFormData({
          action: 'allow',
          direction: 'in',
          port: '',
          protocol: 'tcp',
          from: '',
          comment: ''
        })
        if (onSuccess) {
          onSuccess()
        }
        toast.success("Firewall rule added")
      } catch (error: any) {
        console.error('Failed to add firewall rule:', error)
        const errorMessage = error?.response?.data?.error || error?.message || 'Failed to add firewall rule'
        toast.error(`Add Rule Failed: ${errorMessage}`)
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

  if (isLoading && !firewallStatus) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading firewall settings...</span>
      </div>
    )
  }

  return (
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
                    onClick={firewallStatus.enabled ? onDisableFirewall : onEnableFirewall}
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
                        <AlertDialogAction onClick={onResetFirewall} className="bg-red-600 hover:bg-red-700">
                          Reset
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {/* Default Policies */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="text-center">
                  <Label className="text-sm font-medium flex items-center justify-center gap-2">
                    Incoming
                    {isChangingIncomingPolicy && <RefreshCw className="w-3 h-3 animate-spin" />}
                  </Label>
                  <div className="mt-1">
                    <Select
                      key={`incoming-${firewallStatus.defaultIncoming}`}
                      value={firewallStatus.defaultIncoming}
                      onValueChange={handleIncomingPolicyChange}
                      disabled={!isApiConnected || isChangingIncomingPolicy}
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
                  <Label className="text-sm font-medium flex items-center justify-center gap-2">
                    Outgoing
                    {isChangingOutgoingPolicy && <RefreshCw className="w-3 h-3 animate-spin" />}
                  </Label>
                  <div className="mt-1">
                    <Select
                      key={`outgoing-${firewallStatus.defaultOutgoing}`}
                      value={firewallStatus.defaultOutgoing}
                      onValueChange={handleOutgoingPolicyChange}
                      disabled={!isApiConnected || isChangingOutgoingPolicy}
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
              <Dialog open={addFirewallRuleDialogOpen} onOpenChange={setAddFirewallRuleDialogOpen}>
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
                  <FirewallRuleForm onSuccess={() => setAddFirewallRuleDialogOpen(false)} />
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
                    {firewallStatus.rules.map((rule: any) => (
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
                                  onClick={() => onDeleteFirewallRule(parseInt(rule.id))}
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
  )
} 