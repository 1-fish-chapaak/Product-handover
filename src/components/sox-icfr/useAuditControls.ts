import { useMemo } from 'react';
import { useIcfr } from './store';
import { normaliseProcess, processesForAudit } from './auditScope';
import type { Control } from './types';

/**
 * The controls the OPEN audit covers.
 *
 * Lives apart from auditScope.ts so that module can stay pure: the store needs
 * processesForAudit() when an audit is created, and a store → auditScope →
 * store cycle would break module init. Pure functions there, the hook here.
 *
 * With no audit open — or an audit whose scope resolves to no process — this
 * returns every control untouched. Showing an empty RACM because a scope lookup
 * came up short would read as "this engagement has no controls", which is a
 * worse lie than showing more than the audit strictly covers.
 */
export function useAuditControls(all: Control[]): Control[] {
  const { eng, openAuditId } = useIcfr();
  return useMemo(() => {
    const audit = eng.audits.find(a => a.id === openAuditId);
    // Controls picked one by one on the scope step win over the process filter:
    // they ARE the answer to "what does this audit cover", at the finest grain
    // the wizard offers. Only fall back to processes when nothing was picked.
    if (audit?.controlIds?.length) {
      const ids = new Set(audit.controlIds);
      const hit = all.filter(c => ids.has(c.id));
      // A stale id list (controls deleted since) must not empty the workspace.
      if (hit.length) return hit;
    }
    const procs = processesForAudit(audit, eng.id);
    if (!procs) return all;
    return all.filter(c => procs.includes(normaliseProcess(c.process)));
  }, [all, eng.audits, eng.id, openAuditId]);
}
