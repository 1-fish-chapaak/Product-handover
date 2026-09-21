import type { DashboardFileSource } from '../../../data/dashboardUpdate';
import FilePoolSection from './FilePoolSection';
import SourceReplaceRow from './SourceReplaceRow';
import type { FilePool } from './useFilePool';
import type { FileReplacements } from './useFileReplacements';
import { sectionCls } from './theme';

/** Upload Data: files behind manually created widgets. Add many files to the
 *  pool at once, then assign them to sources from each row's dropdown; Save
 *  (in the dialog footer) swaps the widgets onto the new files — no run. */
export default function UploadDataTab({ sources, pool, replacements, onRemovePoolFile }: {
  sources: DashboardFileSource[];
  pool: FilePool;
  replacements: FileReplacements;
  onRemovePoolFile: (sourceId: string) => void;
}) {
  const disabled = replacements.applying;
  return (
    <div className="flex flex-col gap-4">
      <FilePoolSection pool={pool} disabled={disabled} onRemove={onRemovePoolFile} />
      <section className={sectionCls}>
        <h3 className="text-sm font-semibold text-ink-900 mb-1">Dashboard files</h3>
        <p className="text-xs text-ink-500 mb-3">Files behind manually created widgets.</p>
        <div className="flex flex-col gap-2">
          {sources.map(source => (
            <SourceReplaceRow
              key={source.datasetId}
              source={source}
              state={replacements.replacements[source.datasetId]}
              disabled={disabled}
              pool={pool.readyPool}
              onAssign={poolFile => replacements.assign(source, poolFile)}
              onClear={() => replacements.clear(source.datasetId)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
