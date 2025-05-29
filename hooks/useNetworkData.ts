import { useState, useEffect, useCallback } from 'react';
import { networkAPI, NetworkInterface, RoutingRule, NewRoutingRule, DNSSettings, PingResult, TracerouteResult, NetworkStatistics, FirewallStatus, NewFirewallRule, FirewallLogEntry, NTPSettings } from '@/lib/api';

interface UseNetworkDataReturn {
  interfaces: NetworkInterface[];
  routingRules: RoutingRule[];
  dnsSettings: DNSSettings | null;
  ntpSettings: NTPSettings | null;
  networkStats: NetworkStatistics | null;
  firewallStatus: FirewallStatus | null;
  firewallLogs: FirewallLogEntry[];
  isLoading: boolean;
  isApiConnected: boolean;
  error: string | null;
  refreshAll: () => Promise<void>;
  toggleInterface: (id: string) => Promise<void>;
  updateInterface: (id: string, config: Partial<NetworkInterface>) => Promise<void>;
  addRoute: (route: NewRoutingRule) => Promise<void>;
  deleteRoute: (id: string) => Promise<void>;
  updateDNSSettings: (primary: string, secondary: string, searchDomains: string[]) => Promise<void>;
  updateNTPSettings: (primary: string, fallback: string) => Promise<void>;
  runPingTest: (target: string, count?: number) => Promise<PingResult>;
  runTraceroute: (target: string, maxHops?: number) => Promise<TracerouteResult>;
  fetchNetworkStats: () => Promise<void>;
  // Firewall methods
  fetchFirewallStatus: () => Promise<void>;
  enableFirewall: () => Promise<void>;
  disableFirewall: () => Promise<void>;
  resetFirewall: () => Promise<void>;
  setFirewallDefaultPolicy: (direction: string, policy: string) => Promise<void>;
  addFirewallRule: (rule: NewFirewallRule) => Promise<void>;
  deleteFirewallRule: (ruleNumber: number) => Promise<void>;
  fetchFirewallLogs: (lines?: number) => Promise<void>;
}

export function useNetworkData(): UseNetworkDataReturn {
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);
  const [dnsSettings, setDnsSettings] = useState<DNSSettings | null>(null);
  const [ntpSettings, setNTPSettings] = useState<NTPSettings | null>(null);
  const [networkStats, setNetworkStats] = useState<NetworkStatistics | null>(null);
  const [firewallStatus, setFirewallStatus] = useState<FirewallStatus | null>(null);
  const [firewallLogs, setFirewallLogs] = useState<FirewallLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkApiHealth = useCallback(async () => {
    try {
      const isHealthy = await networkAPI.checkHealth();
      setIsApiConnected(isHealthy);
      return isHealthy;
    } catch (error) {
      setIsApiConnected(false);
      return false;
    }
  }, []);

  const fetchInterfaces = useCallback(async () => {
    try {
      const data = await networkAPI.getInterfaces();
      setInterfaces(data);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch interfaces:', error);
      setError('Failed to load network interfaces');
    }
  }, []);

  const fetchRoutingRules = useCallback(async () => {
    try {
      const data = await networkAPI.getRoutingRules();
      setRoutingRules(data);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch routing rules:', error);
      setError('Failed to load routing rules');
    }
  }, []);

  const fetchDNSSettings = useCallback(async () => {
    try {
      const data = await networkAPI.getDNSSettings();
      setDnsSettings(data);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch DNS settings:', error);
      setError('Failed to load DNS settings');
    }
  }, []);

  const fetchNTPSettings = useCallback(async () => {
    try {
      const data = await networkAPI.getNTPSettings();
      setNTPSettings(data);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch NTP settings:', error);
      setError('Failed to load NTP settings');
    }
  }, []);

  const fetchNetworkStats = useCallback(async () => {
    try {
      const data = await networkAPI.getNetworkStatistics();
      setNetworkStats(data);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch network statistics:', error);
      setError('Failed to load network statistics');
    }
  }, []);

  const fetchFirewallStatus = useCallback(async () => {
    try {
      const data = await networkAPI.getFirewallStatus();
      setFirewallStatus(data);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch firewall status:', error);
      setError('Failed to load firewall status');
    }
  }, []);

  const fetchFirewallLogs = useCallback(async (lines: number = 50) => {
    try {
      const data = await networkAPI.getFirewallLogs(lines);
      setFirewallLogs(data.logs);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch firewall logs:', error);
      setError('Failed to load firewall logs');
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    const isHealthy = await checkApiHealth();
    if (isHealthy) {
      await Promise.all([
        fetchInterfaces(),
        fetchRoutingRules(),
        fetchDNSSettings(),
        fetchNTPSettings(),
        fetchNetworkStats(),
        fetchFirewallStatus()
      ]);
    } else {
      setError('Cannot connect to network management service');
    }
    
    setIsLoading(false);
  }, [checkApiHealth, fetchInterfaces, fetchRoutingRules, fetchDNSSettings, fetchNTPSettings, fetchNetworkStats, fetchFirewallStatus]);

  const toggleInterface = useCallback(async (id: string) => {
    try {
      await networkAPI.toggleInterface(id);
      await fetchInterfaces();
    } catch (error) {
      console.error('Failed to toggle interface:', error);
      throw error;
    }
  }, [fetchInterfaces]);

  const updateInterface = useCallback(async (id: string, config: Partial<NetworkInterface>) => {
    try {
      await networkAPI.updateInterface(id, config);
      // Refresh both interfaces and DNS settings after interface update
      await Promise.all([
        fetchInterfaces(),
        fetchDNSSettings()
      ]);
    } catch (error) {
      console.error('Failed to update interface:', error);
      throw error;
    }
  }, [fetchInterfaces, fetchDNSSettings]);

  const addRoute = useCallback(async (route: NewRoutingRule) => {
    try {
      await networkAPI.addRoute(route);
      await fetchRoutingRules();
    } catch (error) {
      console.error('Failed to add route:', error);
      throw error;
    }
  }, [fetchRoutingRules]);

  const deleteRoute = useCallback(async (id: string) => {
    try {
      await networkAPI.deleteRoute(id);
      await fetchRoutingRules();
    } catch (error) {
      console.error('Failed to delete route:', error);
      throw error;
    }
  }, [fetchRoutingRules]);

  const updateDNSSettings = useCallback(async (primary: string, secondary: string, searchDomains: string[] = []) => {
    try {
      await networkAPI.updateDNSSettings(primary, secondary, searchDomains);
      await fetchDNSSettings();
    } catch (error) {
      console.error('Failed to update DNS settings:', error);
      throw error;
    }
  }, [fetchDNSSettings]);

  const updateNTPSettings = useCallback(async (primary: string, fallback: string) => {
    try {
      await networkAPI.updateNTPSettings(primary, fallback);
      await fetchNTPSettings();
    } catch (error) {
      console.error('Failed to update NTP settings:', error);
      throw error;
    }
  }, [fetchNTPSettings]);

  const runPingTest = useCallback(async (target: string, count: number = 4): Promise<PingResult> => {
    try {
      return await networkAPI.pingTest(target, count);
    } catch (error) {
      console.error('Failed to run ping test:', error);
      throw error;
    }
  }, []);

  const runTraceroute = useCallback(async (target: string, maxHops: number = 15): Promise<TracerouteResult> => {
    try {
      return await networkAPI.traceroute(target, maxHops);
    } catch (error) {
      console.error('Failed to run traceroute:', error);
      throw error;
    }
  }, []);

  const enableFirewall = useCallback(async () => {
    try {
      await networkAPI.enableFirewall();
      await fetchFirewallStatus();
    } catch (error) {
      console.error('Failed to enable firewall:', error);
      throw error;
    }
  }, [fetchFirewallStatus]);

  const disableFirewall = useCallback(async () => {
    try {
      await networkAPI.disableFirewall();
      await fetchFirewallStatus();
    } catch (error) {
      console.error('Failed to disable firewall:', error);
      throw error;
    }
  }, [fetchFirewallStatus]);

  const resetFirewall = useCallback(async () => {
    try {
      await networkAPI.resetFirewall();
      await fetchFirewallStatus();
    } catch (error) {
      console.error('Failed to reset firewall:', error);
      throw error;
    }
  }, [fetchFirewallStatus]);

  const setFirewallDefaultPolicy = useCallback(async (direction: string, policy: string) => {
    try {
      await networkAPI.setFirewallDefaultPolicy(direction, policy);
      await fetchFirewallStatus();
    } catch (error) {
      console.error('Failed to set firewall default policy:', error);
      throw error;
    }
  }, [fetchFirewallStatus]);

  const addFirewallRule = useCallback(async (rule: NewFirewallRule) => {
    try {
      await networkAPI.addFirewallRule(rule);
      await fetchFirewallStatus();
    } catch (error) {
      console.error('Failed to add firewall rule:', error);
      throw error;
    }
  }, [fetchFirewallStatus]);

  const deleteFirewallRule = useCallback(async (ruleNumber: number) => {
    try {
      await networkAPI.deleteFirewallRule(ruleNumber);
      await fetchFirewallStatus();
    } catch (error) {
      console.error('Failed to delete firewall rule:', error);
      throw error;
    }
  }, [fetchFirewallStatus]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  return {
    interfaces,
    routingRules,
    dnsSettings,
    ntpSettings,
    networkStats,
    firewallStatus,
    firewallLogs,
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
    runPingTest,
    runTraceroute,
    fetchNetworkStats,
    fetchFirewallStatus,
    enableFirewall,
    disableFirewall,
    resetFirewall,
    setFirewallDefaultPolicy,
    addFirewallRule,
    deleteFirewallRule,
    fetchFirewallLogs,
  };
} 