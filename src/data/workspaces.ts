/** Workspaces the user can belong to — shared by the login chooser and the
 *  sidebar switcher so both stay in sync. */

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  /** Short context line shown under the name in the workspace chooser. */
  description: string;
}

export const WORKSPACES: Workspace[] = [
  { id: 'platform', name: 'Platform', slug: 'platform', description: 'Internal • all engagements' },
  { id: 'auditify-mvp', name: 'Auditify MVP', slug: 'auditify-mvp', description: 'Client workspace • 12 members' },
];

export const DEFAULT_WORKSPACE = WORKSPACES[0];
