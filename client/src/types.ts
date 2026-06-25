export type Role = 'admin' | 'member';
export type TaskStatus = 'new' | 'assigned' | 'accepted' | 'in_progress' | 'done' | 'closed';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskCategory = 'website_development' | 'creative' | 'content_creation';
export type AttachmentType = 'image' | 'document' | 'link' | 'video' | 'archive';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl?: string | null;
  isActive?: boolean;
  createdAt?: string;
}

export interface UserRef {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  primaryDomain: string | null;
  projectCode: string | null;
  createdAt: string;
  creator?: { id: string; name: string };
  _count?: { tasks: number };
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: UserRef;
}

export interface Attachment {
  id: string;
  type: AttachmentType;
  fileName: string | null;
  fileUrl: string;
  mimeType: string | null;
  createdAt: string;
  uploadedBy?: { id: string; name: string };
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  dueDate: string | null;
  completedAt: string | null;
  closedAt: string | null;
  projectId: string;
  assigneeId: string | null;
  creatorId: string;
  domainName: string | null;
  templateUrl: string | null;
  docFileLink: string | null;
  locationIframe: string | null;
  gtmHead: string | null;
  gtmBody: string | null;
  contentText: string | null;
  contentUrls: string | null;
  createdAt: string;
  updatedAt: string;
  project?: Project | null;
  assignee?: UserRef | null;
  assignees?: UserRef[];
  observers?: UserRef[];
  participants?: UserRef[];
  creator?: UserRef;
  comments?: Comment[];
  attachments?: Attachment[];
  _count?: { comments: number; attachments: number };
}

export interface TaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: TaskCategory;
  dueDate?: string | null;
  projectId?: string | null;
  assigneeId?: string | null;
  assigneeIds?: string[];
  observerIds?: string[];
  participantIds?: string[];
  domainName?: string;
  templateUrl?: string;
  docFileLink?: string;
  locationIframe?: string;
  gtmHead?: string;
  gtmBody?: string;
  contentText?: string;
  contentUrls?: string;
}

export interface AppConfig {
  allowSignup: boolean;
  allowedEmailDomain: string | null;
}
