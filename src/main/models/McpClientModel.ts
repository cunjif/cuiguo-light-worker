import { ClientObj } from '../types.js';

export class McpClientModel {
  private features: any[] = [];
  private clients: ClientObj[] = [];

  setFeatures(features: any[]) {
    this.features = features;
  }

  getFeatures(): any[] {
    return this.features;
  }

  addFeature(feature: any) {
    this.features.push(feature);
  }

  removeFeatureByName(name: string) {
    const index = this.features.findIndex(f => f.name === name);
    if (index !== -1) {
      this.features.splice(index, 1);
    }
  }

  setClients(clients: ClientObj[]) {
    this.clients = clients;
  }

  getClients(): ClientObj[] {
    return this.clients;
  }
}

export const mcpClientModel = new McpClientModel();
