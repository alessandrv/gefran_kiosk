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
        let errorMessage = `HTTP error! status: ${response.status}`;
        
        try {
          // Try to parse as JSON first
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            // If not JSON, get the text content
            const errorText = await response.text();
            // If it's HTML, extract a meaningful error message
            if (errorText.includes('<!DOCTYPE') || errorText.includes('<html>')) {
              errorMessage = `Server returned HTML error page (status: ${response.status})`;
            } else {
              errorMessage = errorText || errorMessage;
            }
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          // Use the original HTTP error message if parsing fails
        }
        
        throw new Error(errorMessage);
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
        let errorMessage = `HTTP error! status: ${response.status}`;
        
        try {
          // Try to parse as JSON first
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            // If not JSON, get the text content
            const errorText = await response.text();
            // If it's HTML, extract a meaningful error message
            if (errorText.includes('<!DOCTYPE') || errorText.includes('<html>')) {
              errorMessage = `Server returned HTML error page (status: ${response.status})`;
            } else {
              errorMessage = errorText || errorMessage;
            }
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          // Use the original HTTP error message if parsing fails
        }
        
        throw new Error(errorMessage);
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
}

export const networkAPI = new NetworkAPI();
export default networkAPI; 