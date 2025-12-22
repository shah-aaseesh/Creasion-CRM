
export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  createdAt: string;
}

export type ServiceType = 'domain' | 'hosting' | 'both' | 'custom';
export type Currency = 'NPR' | 'INR' | 'USD';

export interface AdditionalService {
  id: string;
  name: string;
  cost: number;
  costCurrency: Currency;
  charge: number;
  chargeCurrency: Currency;
  expiry?: string;
}

export interface Service {
  id: string;
  clientId: string;
  type: ServiceType;
  
  // Domain specific
  domainName?: string;
  registrar?: string;
  domainCost?: number;
  domainCostCurrency?: Currency;
  domainCharge?: number;
  domainChargeCurrency?: Currency;
  domainExpiry?: string;
  
  // Hosting specific
  hostingProvider?: string;
  hostingPlan?: string;
  hostingCost?: number;
  hostingCostCurrency?: Currency;
  hostingCharge?: number;
  hostingChargeCurrency?: Currency;
  hostingExpiry?: string;
  hostingServerIp?: string;
  hostingCpUrl?: string;

  // Additional services
  additionalServices?: AdditionalService[];

  // Common or shared
  isSynced: boolean; 
  notes: string;
  createdAt: string;
}

export interface Credential {
  id: string;
  serviceId: string;
  title: string;
  url: string;
  username: string;
  passwordEncrypted: string;
  notes: string;
}

// Independent Feature: Hosting Sites
export interface HostingPlan {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

export interface HostingSite {
  id: string;
  plan_id: string;
  domain_name: string;
  user_id: string;
  created_at: string;
}

export interface AppData {
  clients: Client[];
  services: Service[];
  credentials: Credential[];
  settings: {
    masterPasswordHash: string;
    appPasswordHash: string;
    lastBackup: string;
  };
}

export enum ExpiryStatus {
  ACTIVE = 'ACTIVE',
  EXPIRING = 'EXPIRING',
  EXPIRED = 'EXPIRED'
}