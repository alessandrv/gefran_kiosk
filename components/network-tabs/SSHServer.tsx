"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Terminal, RefreshCw } from "lucide-react"
import toast from "react-hot-toast"

interface SSHServerProps {
  sshStatus: any
  isLoading: boolean
  isApiConnected: boolean
  onEnableSSH: () => void
  onDisableSSH: () => void
}

export default function SSHServer({
  sshStatus,
  isLoading,
  isApiConnected,
  onEnableSSH,
  onDisableSSH,
}: SSHServerProps) {
  const [isEnabling, setIsEnabling] = useState(false)
  const [isDisabling, setIsDisabling] = useState(false)
  const [isToggling, setIsToggling] = useState(false)

  const handleEnableSSH = async () => {
    try {
      setIsEnabling(true)
      await onEnableSSH()
      toast.success("SSH Server Enabled")
    } catch (error: any) {
      console.error('Failed to enable SSH:', error)
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to enable SSH server'
      toast.error(`SSH Enable Failed: ${errorMessage}`)
    } finally {
      setIsEnabling(false)
    }
  }

  const handleDisableSSH = async () => {
    try {
      setIsDisabling(true)
      await onDisableSSH()
      toast.success("SSH Server Disabled")
    } catch (error: any) {
      console.error('Failed to disable SSH:', error)
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to disable SSH server'
      toast.error(`SSH Disable Failed: ${errorMessage}`)
    } finally {
      setIsDisabling(false)
    }
  }

  const handleToggleSSH = async () => {
    try {
      setIsToggling(true)
      if (sshStatus?.enabled) {
        await onDisableSSH()
        toast.success('SSH server disabled successfully')
      } else {
        await onEnableSSH()
        toast.success('SSH server enabled successfully')
      }
    } catch (error: any) {
      console.error('Failed to toggle SSH:', error)
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to toggle SSH server'
      toast.error(`SSH Toggle Failed: ${errorMessage}`)
    } finally {
      setIsToggling(false)
    }
  }

  return (
    <Card className="bg-white max-w-xl mx-auto">
      <CardHeader>
        <CardTitle className="text-blue-600 flex items-center gap-2">
          <Terminal className="w-5 h-5" />
          SSH Server Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${sshStatus?.enabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="font-medium">
            {sshStatus?.enabled ? 'SSH server is ENABLED' : 'SSH server is DISABLED'}
          </span>
        </div>
        <div className="flex gap-2 pt-2">
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleEnableSSH}
            disabled={isLoading || sshStatus?.enabled || isEnabling}
          >
            {isEnabling ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Terminal className="w-4 h-4 mr-2" />}
            Enable SSH
          </Button>
          <Button
            variant="destructive"
            onClick={handleDisableSSH}
            disabled={isLoading || !sshStatus?.enabled || isDisabling}
          >
            {isDisabling ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Terminal className="w-4 h-4 mr-2" />}
            Disable SSH
          </Button>
        </div>
        <div className="text-xs text-gray-500 pt-4">
          L'accesso SSH permette la gestione remota del sistema tramite client SSH (porta 22).<br />
          Disabilitare SSH per aumentare la sicurezza quando non necessario.
        </div>
      </CardContent>
    </Card>
  )
} 