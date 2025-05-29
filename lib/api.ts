const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface NetworkInterface {
  id: string;
  name: string;
  mac: string;
  type: "DHCP" | "Static";
  address: string;
  secondaryAddress: string;
  netmask: string;
  gateway: string;
  dns1: string;
  dns2: string;
  status: "active" | "inactive";
  enabled: boolean;
}

export interface RoutingRule {
  id: string;
  destination: string;
  gateway: string;
  interface: string;
  metric: number;
  enabled: boolean;
  protocol?: string;
}

export interface NewRoutingRule {
  destination: string;
  gateway?: string;
  interface: string;
  metric?: number;
}

export interface DNSSettings {
  global: {
    primary: string;
    secondary: string;
    searchDomains: string[];
  };
  interfaces: {
    [interfaceName: string]: {
      primary: string;
      secondary: string;
    };
  };
}

export interface PingResult {
  target: string;
  success: boolean;
  packets?: {
    transmitted: number;
    received: number;
    loss: number;
  };
  timing?: {
    min: number;
    avg: number;
    max: number;
    mdev: number;
  };
  output: string;
  error?: string;
}

export interface TracerouteResult {
  target: string;
  success: boolean;
  hops?: Array<{
    hop: number;
    details: string;
  }>;
  output: string;
  error?: string;
}

export interface NetworkStatistics {
  interfaces: {
    [interfaceName: string]: {
      rx: {
        bytes: number;
        packets: number;
        errors: number;
        dropped: number;
      };
      tx: {
        bytes: number;
        packets: number;
        errors: number;
        dropped: number;
      };
    };
  };
  connections: {
    tcp: number;
    udp: number;
    listening: number;
  };
  timestamp: string;
}

export interface FirewallRule {
  id: string;
  port: string;
  action: 'allow' | 'deny' | 'reject';
  direction: 'in' | 'out';
  from: string;
  enabled: boolean;
}

export interface FirewallStatus {
  enabled: boolean;
  defaultIncoming: 'allow' | 'deny' | 'reject';
  defaultOutgoing: 'allow' | 'deny' | 'reject';
  defaultRouted: 'allow' | 'deny' | 'reject' | 'disabled';
  rules: FirewallRule[];
  profiles: string[];
}

export interface NewFirewallRule {
  action: 'allow' | 'deny' | 'reject';
  direction?: 'in' | 'out';
  port?: string;
  protocol?: 'tcp' | 'udp';
  from?: string;
  to?: string;
  comment?: string;
}

export interface FirewallLogEntry {
  timestamp: string;
  message: string;
  raw: string;
}

export interface NTPSettings {
  primary: string;
  fallback: string;
  status: {
    synchronized: boolean;
    ntpService: string;
    server: string;
    pollInterval: number;
  };
}

class NetworkAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  async getInterfaces(): Promise<NetworkInterface[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network/interfaces`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.interfaces || [];
    } catch (error) {
      console.error('Failed to fetch network interfaces:', error);
      // Return empty array as fallback
      return [];
    }
  }

  async getRoutingRules(): Promise<RoutingRule[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network/routing`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.routes || [];
    } catch (error) {
      console.error('Failed to fetch routing rules:', error);
      return [];
    }
  }

  async toggleInterface(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network/interfaces/${id}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to toggle interface:', error);
      throw error;
    }
  }

  async updateInterface(id: string, config: Partial<NetworkInterface>): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network/interfaces/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to update interface:', error);
      throw error;
    }
  }

  async addRoute(route: NewRoutingRule): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network/routing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(route),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to add route:', error);
      throw error;
    }
  }

  async deleteRoute(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network/routing/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to delete route:', error);
      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      return response.ok;
    } catch (error) {
      console.error('API health check failed:', error);
      return false;
    }
  }

  // DNS Settings methods
  async getDNSSettings(): Promise<DNSSettings> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network/dns`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch DNS settings:', error);
      throw error;
    }
  }

  async updateDNSSettings(primary: string, secondary: string, searchDomains: string[] = []): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network/dns`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ primary, secondary, searchDomains }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to update DNS settings:', error);
      throw error;
    }
  }

  // Network Diagnostics methods
  async pingTest(target: string, count: number = 4): Promise<PingResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network/diagnostics/ping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target, count }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to run ping test:', error);
      throw error;
    }
  }

  async traceroute(target: string, maxHops: number = 15): Promise<TracerouteResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network/diagnostics/traceroute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target, maxHops }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to run traceroute:', error);
      throw error;
    }
  }

  async getNetworkStatistics(): Promise<NetworkStatistics> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network/statistics`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get network statistics:', error);
      throw error;
    }
  }

  // Firewall methods
  async getFirewallStatus(): Promise<FirewallStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network/firewall/status`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get firewall status:', error);
      throw error;
    }
  }

  async enableFirewall(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network/firewall/enable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to enable firewall:', error);
      throw error;
    }
  }

  async disableFirewall(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network/firewall/disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to disable firewall:', error);
      throw error;
    }
  }

  async resetFirewall(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network/firewall/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to reset firewall:', error);
      throw error;
    }
  }

  async setFirewallDefaultPolicy(direction: string, policy: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network/firewall/default`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ direction, policy }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to set firewall default policy:', error);
      throw error;
    }
  }

  async addFirewallRule(rule: NewFirewallRule): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network/firewall/rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rule),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to add firewall rule:', error);
      throw error;
    }
  }

  async deleteFirewallRule(ruleNumber: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network/firewall/rules/${ruleNumber}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to delete firewall rule:', error);
      throw error;
    }
  }

  async getFirewallLogs(lines: number = 50): Promise<{ logs: FirewallLogEntry[] }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network/firewall/logs?lines=${lines}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get firewall logs:', error);
      throw error;
    }
  }

  // NTP methods
  async getNTPSettings(): Promise<NTPSettings> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network/ntp`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get NTP settings:', error);
      throw error;
    }
  }

  async updateNTPSettings(primary: string, fallback: string = ''): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network/ntp`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ primary, fallback }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to update NTP settings:', error);
      throw error;
    }
  }
}

export const networkAPI = new NetworkAPI();
export default networkAPI; 