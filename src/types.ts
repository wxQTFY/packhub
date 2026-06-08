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
  category: string;
  tags: string[];
  releaseNotes: string;
  stable: boolean;
  archived: boolean;
  originalName: string;
  size: number;
  sha256: string;
  downloadCount: number;
  lastDownloadedAt: string | null;
  createdAt: string;
  published: boolean;
}

export interface DownloadLog {
  id: string;
  packageId: string;
  packageName: string;
  packageVersion: string;
  packageCategory: string;
  originalName: string;
  userId: string;
  username: string;
  ip: string;
  userAgent: string;
  createdAt: string;
}

export interface DashboardSummary {
  totalPackages: number;
  publishedPackages: number;
  softwareCount: number;
  categoryCount: number;
  totalSize: number;
  totalDownloads: number;
  byChannel: Record<VersionChannel, number>;
  recent: SoftwarePackage[];
  popular: SoftwarePackage[];
}
