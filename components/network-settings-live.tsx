"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import {
  Network,
  Router,
  Globe,
  Shield,
  Activity,
  Settings,
  Globe2,
  Terminal,
  HardDrive,
  MonitorSpeaker,
  Monitor,
  Sun,
  X,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react"
import { useNetworkData } from "@/hooks/useNetworkData"
import {
  NetworkInterfaces,
  RoutingRules,
  DNSSettings,
  SecuritySettings,
  NetworkDiagnostics,
  GeneralSettings,
  BrowserSettings,
  SSHServer,
  FTPServer,
  X11VNCSettings,
  ScreenSettings,
  ScreensaverSettings,
} from "@/components/network-tabs"

export default function NetworkSettingsLive() {
  const {
    interfaces,
    routingRules,
    dnsSettings,
    ntpSettings,
    browserSettings,
    hostnameInfo,
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
    updateNTPSettings,
    updateBrowserSettings,
    updateHostname,
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
    wifiNetworks,
    wifiStatus,
    scanWifiNetworks,
    connectToWifiNetwork,
    disconnectWifiNetwork,
    getWifiStatus,
    forgetWifiNetwork,
    sshStatus,
    enableSSH,
    disableSSH,
    fetchSSHStatus,
    x11vncSettings,
    fetchX11VNCSettings,
    configureX11VNC,
    ftpSettings,
    ftpLogs,
    fetchFTPSettings,
    configureFTP,
    fetchFTPLogs,
    screenSettings,
    fetchScreenSettings,
    setScreenBrightness,
    setScreenRotation,
    rotateScreenLeft,
    rotateScreenRight,
    resetScreenRotation,
    screensaverSettings,
    fetchScreensaverSettings,
    configureScreensaver,
    testScreensaver,
  } = useNetworkData()

  const [activeSection, setActiveSection] = useState("Network Interfaces")

  const handleCloseApp = () => {
    if ((window as any).electron && (window as any).electron.closeApp) {
      (window as any).electron.closeApp()
    } else {
      console.log('Close app requested')
      window.close()
    }
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

  const renderContent = () => {
    switch (activeSection) {
      case "Network Interfaces":
        return (
          <NetworkInterfaces
            interfaces={interfaces}
            wifiNetworks={wifiNetworks}
            wifiStatus={wifiStatus}
            dnsSettings={dnsSettings}
            isApiConnected={isApiConnected}
            isLoading={isLoading}
            onToggleInterface={toggleInterface}
            onUpdateInterface={updateInterface}
            onScanWifiNetworks={scanWifiNetworks}
            onConnectToWifiNetwork={connectToWifiNetwork}
            onDisconnectWifiNetwork={disconnectWifiNetwork}
            onForgetWifiNetwork={forgetWifiNetwork}
          />
        )
      case "Routing Rules":
        return (
          <RoutingRules
            routingRules={routingRules}
            interfaces={interfaces}
            isApiConnected={isApiConnected}
            isLoading={isLoading}
            onAddRoute={addRoute}
            onDeleteRoute={deleteRoute}
          />
        )
      case "DNS Settings":
        return (
          <DNSSettings
            dnsSettings={dnsSettings}
            interfaces={interfaces}
            isApiConnected={isApiConnected}
            isLoading={isLoading}
            onUpdateDNSSettings={updateDNSSettings}
            onUpdateInterface={updateInterface}
          />
        )
      case "Security Settings":
        return (
          <SecuritySettings
            firewallStatus={firewallStatus}
            isApiConnected={isApiConnected}
            isLoading={isLoading}
            onEnableFirewall={enableFirewall}
            onDisableFirewall={disableFirewall}
            onResetFirewall={resetFirewall}
            onSetFirewallDefaultPolicy={setFirewallDefaultPolicy}
            onAddFirewallRule={addFirewallRule}
            onDeleteFirewallRule={deleteFirewallRule}
          />
        )
      case "Network Diagnostics":
        return (
          <NetworkDiagnostics
            networkStats={networkStats}
            isApiConnected={isApiConnected}
            isLoading={isLoading}
            onRunPingTest={runPingTest}
            onRunTraceroute={runTraceroute}
            onFetchNetworkStats={fetchNetworkStats}
          />
        )
      case "General Settings":
        return (
          <GeneralSettings
            ntpSettings={ntpSettings}
            hostnameInfo={hostnameInfo}
            isApiConnected={isApiConnected}
            isLoading={isLoading}
            onUpdateNTPSettings={updateNTPSettings}
            onUpdateHostname={updateHostname}
          />
        )
      case "Browser Settings":
        return (
          <BrowserSettings
            browserSettings={browserSettings}
            isApiConnected={isApiConnected}
            isLoading={isLoading}
            onUpdateBrowserSettings={updateBrowserSettings}
          />
        )
      case "SSH Server":
        return (
          <SSHServer
            sshStatus={sshStatus}
            isLoading={isLoading}
            isApiConnected={isApiConnected}
            onEnableSSH={enableSSH}
            onDisableSSH={disableSSH}
          />
        )
      case "FTP Server":
        return (
          <FTPServer
            ftpSettings={ftpSettings}
            ftpLogs={ftpLogs}
            isApiConnected={isApiConnected}
            isLoading={isLoading}
            onConfigureFTP={configureFTP}
            onFetchFTPLogs={fetchFTPLogs}
          />
        )
      case "X11VNC Remote Access":
        return (
          <X11VNCSettings
            x11vncSettings={x11vncSettings}
            isApiConnected={isApiConnected}
            isLoading={isLoading}
            onConfigureX11VNC={configureX11VNC}
          />
        )
      case "Screen Settings":
        return (
          <ScreenSettings
            screenSettings={screenSettings}
            isApiConnected={isApiConnected}
            isLoading={isLoading}
            onSetScreenBrightness={setScreenBrightness}
            onRotateScreenLeft={rotateScreenLeft}
            onRotateScreenRight={rotateScreenRight}
            onResetScreenRotation={resetScreenRotation}
          />
        )
      case "Screensaver Settings":
        return (
          <ScreensaverSettings
            screensaverSettings={screensaverSettings}
            isApiConnected={isApiConnected}
            isLoading={isLoading}
            onConfigureScreensaver={configureScreensaver}
            onTestScreensaver={testScreensaver}
          />
        )
      default:
        return (
          <NetworkInterfaces
            interfaces={interfaces}
            wifiNetworks={wifiNetworks}
            wifiStatus={wifiStatus}
            dnsSettings={dnsSettings}
            isApiConnected={isApiConnected}
            isLoading={isLoading}
            onToggleInterface={toggleInterface}
            onUpdateInterface={updateInterface}
            onScanWifiNetworks={scanWifiNetworks}
            onConnectToWifiNetwork={connectToWifiNetwork}
            onDisconnectWifiNetwork={disconnectWifiNetwork}
            onForgetWifiNetwork={forgetWifiNetwork}
          />
        )
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
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white hover:bg-blue-700 hover:bg-opacity-50"
              onClick={handleCloseApp}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Left Sidebar */}
        <div className="w-64 bg-blue-600 text-white min-h-screen">
          <div className="p-4 space-y-1">
            <Accordion className="px-3" type="single" collapsible defaultValue="network">
              <AccordionItem value="network">
                <AccordionTrigger className="w-full px-0">
                  <span className="text-base flex items-center gap-3">
                    <Network className="w-4 h-4" /> Network
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <button
                    onClick={() => setActiveSection("Network Interfaces")}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded transition-colors ${activeSection === "Network Interfaces" ? "bg-blue-700 text-white" : "text-blue-100 hover:bg-blue-700 hover:text-white"}`}
                  >
                    <Network className="w-4 h-4" />
                    Network Interfaces
                  </button>
                  <button
                    onClick={() => setActiveSection("Routing Rules")}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded transition-colors ${activeSection === "Routing Rules" ? "bg-blue-700 text-white" : "text-blue-100 hover:bg-blue-700 hover:text-white"}`}
                  >
                    <Router className="w-4 h-4" />
                    Routing Rules
                  </button>
                  <button
                    onClick={() => setActiveSection("DNS Settings")}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded transition-colors ${activeSection === "DNS Settings" ? "bg-blue-700 text-white" : "text-blue-100 hover:bg-blue-700 hover:text-white"}`}
                  >
                    <Globe className="w-4 h-4" />
                    DNS Settings
                  </button>
                  <button
                    onClick={() => setActiveSection("Security Settings")}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded transition-colors ${activeSection === "Security Settings" ? "bg-blue-700 text-white" : "text-blue-100 hover:bg-blue-700 hover:text-white"}`}
                  >
                    <Shield className="w-4 h-4" />
                    Security Settings
                  </button>
                  <button
                    onClick={() => setActiveSection("Network Diagnostics")}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded transition-colors ${activeSection === "Network Diagnostics" ? "bg-blue-700 text-white" : "text-blue-100 hover:bg-blue-700 hover:text-white"}`}
                  >
                    <Activity className="w-4 h-4" />
                    Network Diagnostics
                  </button>
                  <button
                    onClick={() => setActiveSection("SSH Server")}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded transition-colors ${activeSection === "SSH Server" ? "bg-blue-700 text-white" : "text-blue-100 hover:bg-blue-700 hover:text-white"}`}
                  >
                    <Terminal className="w-4 h-4" />
                    SSH Server
                  </button>
                  <button
                    onClick={() => setActiveSection("FTP Server")}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded transition-colors ${activeSection === "FTP Server" ? "bg-blue-700 text-white" : "text-blue-100 hover:bg-blue-700 hover:text-white"}`}
                  >
                    <HardDrive className="w-4 h-4" />
                    FTP Server
                  </button>
                  <button
                    onClick={() => setActiveSection("X11VNC Remote Access")}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded transition-colors ${activeSection === "X11VNC Remote Access" ? "bg-blue-700 text-white" : "text-blue-100 hover:bg-blue-700 hover:text-white"}`}
                  >
                    <MonitorSpeaker className="w-4 h-4" />
                    X11VNC
                  </button>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <div className="space-y-1">
              <button
                onClick={() => setActiveSection("General Settings")}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded transition-colors ${activeSection === "General Settings" ? "bg-blue-700 text-white" : "text-blue-100 hover:bg-blue-700 hover:text-white"}`}
              >
                <Settings className="w-4 h-4" />
                General Settings
              </button>
              <button
                onClick={() => setActiveSection("Browser Settings")}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded transition-colors ${activeSection === "Browser Settings" ? "bg-blue-700 text-white" : "text-blue-100 hover:bg-blue-700 hover:text-white"}`}
              >
                <Globe2 className="w-4 h-4" />
                Browser Settings
              </button>
              <button
                onClick={() => setActiveSection("Screen Settings")}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded transition-colors ${activeSection === "Screen Settings" ? "bg-blue-700 text-white" : "text-blue-100 hover:bg-blue-700 hover:text-white"}`}
              >
                <Monitor className="w-4 h-4" />
                Screen Settings
              </button>
              <button
                onClick={() => setActiveSection("Screensaver Settings")}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded transition-colors ${activeSection === "Screensaver Settings" ? "bg-blue-700 text-white" : "text-blue-100 hover:bg-blue-700 hover:text-white"}`}
              >
                <Sun className="w-4 h-4" />
                Screensaver Settings
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{activeSection}</h2>
            </div>

            {renderConnectionStatus()}

            {/* Dynamic Content */}
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
} 