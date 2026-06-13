export interface BrandProfileAdmin {
  id: string;
  name: string;
  serviceName: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  targetUsers: string[];
  coreFeatures: string[];
  problemsSolved: string[];
  mainUrl: string | null;
  ctaWeak: string | null;
  ctaNormal: string | null;
  ctaStrong: string | null;
  forbiddenPhrases: string[];
  preferredPhrases: string[];
  riskDisclaimer: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
