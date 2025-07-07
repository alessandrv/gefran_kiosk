"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Activity,
  Router,
  RefreshCw,
  CheckCircle,
  AlertCircle,
} from "lucide-react"
import { ValidatedInput } from "@/components/ui/validated-input"

interface NetworkDiagnosticsProps {
  networkStats: any
  isApiConnected: boolean
  isLoading: boolean
  onRunPingTest: (target: string, count: number) => Promise<any>
  onRunTraceroute: (target: string, maxHops: number) => Promise<any>
  onFetchNetworkStats: () => Promise<void>
}

export default function NetworkDiagnostics({
  networkStats,
  isApiConnected,
  isLoading,
  onRunPingTest,
  onRunTraceroute,
  onFetchNetworkStats,
}: NetworkDiagnosticsProps) {
  const [pingTarget, setPingTarget] = useState('google.com')
  const [pingResult, setPingResult] = useState<any>(null)
  const [isPinging, setIsPinging] = useState(false)
  const [tracerouteTarget, setTracerouteTarget] = useState('8.8.8.8')
  const [tracerouteResult, setTracerouteResult] = useState<any>(null)
  const [isTracerouting, setIsTracerouting] = useState(false)

  const handlePingTest = async () => {
    try {
      setIsPinging(true)
      const result = await onRunPingTest(pingTarget, 4)
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
      const result = await onRunTraceroute(tracerouteTarget, 15)
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
                <ValidatedInput
                  id="ping-target"
                  value={pingTarget}
                  onChange={(e) => setPingTarget(e.target.value)}
                  placeholder="8.8.8.8 or google.com"
                  disabled={!isApiConnected}
                  validationType="dns"
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
                <ValidatedInput
                  id="traceroute-target"
                  value={tracerouteTarget}
                  onChange={(e) => setTracerouteTarget(e.target.value)}
                  placeholder="8.8.8.8 or google.com"
                  disabled={!isApiConnected}
                  validationType="dns"
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
              onClick={onFetchNetworkStats}
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
                  {Object.entries(networkStats.interfaces).map(([interfaceName, stats]: [string, any]) => (
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
  )
} 