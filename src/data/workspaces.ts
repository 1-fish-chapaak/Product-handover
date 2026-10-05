/** Workspaces the user can belong to — shared by the login chooser and the
 *  sidebar switcher so both stay in sync. */

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  /** Short context line shown under the name in the workspace chooser. */
  description: string;
  /** A client on its first login — no workflows, no custom controls yet.
   *  Drives the Control Library's first-time experience. */
  fresh?: boolean;
}

export const WORKSPACES: Workspace[] = [
  { id: 'platform', name: 'Platform', slug: 'platform', description: 'Internal • all engagements' },
  { id: 'auditify-mvp', name: 'Auditify MVP', slug: 'auditify-mvp', description: 'Client workspace • 12 members' },
  { id: 'acme', name: 'Acme Industries', slug: 'acme', description: 'New client • first login, nothing set up yet', fresh: true },
];

export const DEFAULT_WORKSPACE = WORKSPACES[0];
