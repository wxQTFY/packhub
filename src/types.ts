export type Permission = 'portal.download' | 'admin.users' | 'admin.software';
export type VersionChannel = 'release' | 'beta' | 'history';

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'user';
  permissions: Permission[];
  enabled: boolean;
  createdAt: string;
}

export interface SoftwarePackage {
  id: string;
  name: string;
  description: string;
  version: string;
  channel: VersionChannel;
  originalName: string;
  size: number;
  createdAt: string;
  published: boolean;
}
