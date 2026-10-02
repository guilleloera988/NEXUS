export const INTERESTS = ['software', 'data', 'ai', 'design', 'marketing', 'operations', 'manufacturing', 'logistics', 'finance', 'sustainability', 'social_impact', 'health', 'education', 'strategy', 'energy'] as const;
export const INDUSTRIES = ['manufacturing', 'automotive', 'technology', 'agribusiness', 'logistics', 'retail', 'financial_services', 'health', 'education', 'energy', 'public_sector', 'other'] as const;
export const MODALITIES = ['remote', 'hybrid', 'onsite'] as const;
export const COMPENSATION_TYPES = ['paid', 'stipend', 'prize', 'in_kind', 'none'] as const;
export const IP_POLICIES = ['student_owns', 'shared', 'company_license', 'company_owns', 'to_be_agreed'] as const;
export const CONFIDENTIALITY = ['public', 'confidential', 'nda_required'] as const;
export const PUBLICATION_POLICIES = ['public_allowed', 'summary_only', 'confidential'] as const;
export const AVAILABILITY = ['full_time', 'part_time', 'weekends', 'flexible', 'not_available'] as const;
export const ORG_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'] as const;
export const CHALLENGE_STATUSES = ['draft', 'published', 'recruiting', 'active', 'under_review', 'completed', 'archived'] as const;
export const LINK_KINDS = ['link', 'repository', 'video', 'presentation', 'document'] as const;
export const FILE_KINDS = ['pdf', 'image', 'document', 'presentation', 'file'] as const;
export const UNPAID_VATH_LIMIT = 60;

/** Allowed status transitions (mirrors sp_set_challenge_status). */
export const CHALLENGE_TRANSITIONS: Record<(typeof CHALLENGE_STATUSES)[number], (typeof CHALLENGE_STATUSES)[number][]> = {
  draft: ['recruiting', 'published', 'archived'],
  published: ['recruiting', 'active', 'draft', 'archived'],
  recruiting: ['active', 'published', 'archived'],
  active: ['under_review', 'completed', 'recruiting'],
  under_review: ['completed', 'active'],
  completed: ['archived'],
  archived: [],
};

/** MIME types accepted for evidence uploads, with the evidence kind they map to. */
export const UPLOAD_TYPES: Record<string, { kind: (typeof FILE_KINDS)[number]; ext: string[] }> = {
  'application/pdf': { kind: 'pdf', ext: ['pdf'] },
  'image/png': { kind: 'image', ext: ['png'] },
  'image/jpeg': { kind: 'image', ext: ['jpg', 'jpeg'] },
  'image/webp': { kind: 'image', ext: ['webp'] },
  'image/gif': { kind: 'image', ext: ['gif'] },
  'text/plain': { kind: 'document', ext: ['txt', 'md'] },
  'text/csv': { kind: 'document', ext: ['csv'] },
  'application/zip': { kind: 'file', ext: ['zip'] },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { kind: 'presentation', ext: ['pptx'] },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { kind: 'document', ext: ['docx'] },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { kind: 'document', ext: ['xlsx'] },
  'application/msword': { kind: 'document', ext: ['doc'] },
  'application/vnd.ms-powerpoint': { kind: 'presentation', ext: ['ppt'] },
  'application/vnd.ms-excel': { kind: 'document', ext: ['xls'] },
};
