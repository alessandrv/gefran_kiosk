import { useState, useEffect, useCallback } from 'react';
import { networkAPI, NetworkInterface, RoutingRule, NewRoutingRule } from '@/lib/api';

interface UseNetworkDataReturn {
  interfaces: NetworkInterface[];
  routingRules: RoutingRule[];
  isLoading: boolean;
  isApiConnected: boolean;
  error: string | null;
  refreshInterfaces: () => Promise<void>;
  refreshRoutingRules: () => Promise<void>;
  refreshAll: () => Promise<void>;
  toggleInterface: (id: string) => Promise<void>;
  updateInterface: (id: string, config: Partial<NetworkInterface>) => Promise<void>;
  addRoute: (route: NewRoutingRule) => Promise<void>;
  deleteRoute: (id: string) => Promise<void>;
}

export function useNetworkData(): UseNetworkDataReturn {
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkApiHealth = useCallback(async () => {
    try {
      const healthy = await networkAPI.checkHealth();
      setIsApiConnected(healthy);
      return healthy;
    } catch (error) {
      setIsApiConnected(false);
      return false;
    }
  }, []);

  const refreshInterfaces = useCallback(async () => {
    try {
      setError(null);
      const data = await networkAPI.getInterfaces();
      setInterfaces(data);
    } catch (error) {
      console.error('Failed to refresh interfaces:', error);
      setError('Failed to fetch network interfaces');
      // Keep existing data on error
    }
  }, []);

  const refreshRoutingRules = useCallback(async () => {
    try {
      setError(null);
      const data = await networkAPI.getRoutingRules();
      setRoutingRules(data);
    } catch (error) {
      console.error('Failed to refresh routing rules:', error);
      setError('Failed to fetch routing rules');
      // Keep existing data on error
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    try {
      await checkApiHealth();
      await Promise.all([refreshInterfaces(), refreshRoutingRules()]);
    } finally {
      setIsLoading(false);
    }
  }, [checkApiHealth, refreshInterfaces, refreshRoutingRules]);

  const toggleInterface = useCallback(async (id: string) => {
    try {
      await networkAPI.toggleInterface(id);
      // Refresh interfaces after toggle
      await refreshInterfaces();
    } catch (error) {
      console.error('Failed to toggle interface:', error);
      setError('Failed to toggle interface');
      throw error;
    }
  }, [refreshInterfaces]);

  const updateInterface = useCallback(async (id: string, config: Partial<NetworkInterface>) => {
    try {
      await networkAPI.updateInterface(id, config);
      // Refresh interfaces after update
      await refreshInterfaces();
    } catch (error) {
      console.error('Failed to update interface:', error);
      setError('Failed to update interface');
      throw error;
    }
  }, [refreshInterfaces]);

  const addRoute = useCallback(async (route: NewRoutingRule) => {
    try {
      await networkAPI.addRoute(route);
      // Refresh routing rules after adding route
      await refreshRoutingRules();
    } catch (error) {
      console.error('Failed to add route:', error);
      setError('Failed to add route');
      throw error;
    }
  }, [refreshRoutingRules]);

  const deleteRoute = useCallback(async (id: string) => {
    try {
      await networkAPI.deleteRoute(id);
      // Refresh routing rules after deleting route
      await refreshRoutingRules();
    } catch (error) {
      console.error('Failed to delete route:', error);
      setError('Failed to delete route');
      throw error;
    }
  }, [refreshRoutingRules]);

  // Initial data load
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Periodic health check and data refresh
  useEffect(() => {
    const interval = setInterval(async () => {
      await checkApiHealth();
      if (isApiConnected) {
        await refreshInterfaces();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [checkApiHealth, refreshInterfaces, isApiConnected]);

  return {
    interfaces,
    routingRules,
    isLoading,
    isApiConnected,
    error,
    refreshInterfaces,
    refreshRoutingRules,
    refreshAll,
    toggleInterface,
    updateInterface,
    addRoute,
    deleteRoute,
  };
} 