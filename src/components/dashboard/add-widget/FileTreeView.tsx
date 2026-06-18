import { useState } from "react";
import { FileText, ChevronDown, LayoutGrid, GripVertical, Database } from "lucide-react";

export interface FileTreeSheet { name: string; columns: string[]; }
export interface FileTreeFile { name: string; icon?: 'excel' | 'csv' | 'database'; sheets: FileTreeSheet[]; }

export const FILE_TREE_DATA: FileTreeFile[] = [
  {
    name: 'Invoice_Master.xlsx',
    icon: 'excel',
    sheets: [
      { name: 'Sheet1', columns: ['Date', 'Month', 'Week', 'Year', 'Region', 'State', 'Vendor Name', 'Status', 'Category', 'Invoice Amount (₹)', 'Duplicate Count', 'Duplicate Score (%)'] },
      { name: 'Sheet2', columns: ['Order ID', 'Order Date', 'Ship Date', 'Priority', 'Quantity'] },
    ],
  },
  {
    name: 'Vendor_Finance.xlsx',
    icon: 'excel',
    sheets: [
      { name: 'Sheet1', columns: ['Vendor ID', 'Vendor Name', 'Payment Terms', 'Credit Limit', 'Outstanding Amount', 'Risk Score'] },
    ],
  },
];

export function FileTreeView({ files, search, draggable, fieldIdMap }: {
  files: FileTreeFile[];
  search?: string;
  draggable?: boolean;
  fieldIdMap?: Record<string, string>;
}) {
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({ [files[0]?.name]: true });
  const [expandedSheets, setExpandedSheets] = useState<Record<string, boolean>>({ [`${files[0]?.name}::${files[0]?.sheets[0]?.name}`]: true });

  const toggleFile = (name: string) => setExpandedFiles(p => ({ ...p, [name]: !p[name] }));
  const toggleSheet = (key: string) => setExpandedSheets(p => ({ ...p, [key]: !p[key] }));

  const filteredFiles = files.map(f => ({
    ...f,
    sheets: f.sheets.map(s => ({
      ...s,
      columns: search ? s.columns.filter(c => c.toLowerCase().includes(search.toLowerCase())) : s.columns,
    })).filter(s => !search || s.columns.length > 0),
  })).filter(f => !search || f.sheets.length > 0 || f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-2">
      {filteredFiles.map(file => {
        const isFileOpen = expandedFiles[file.name] ?? false;
        return (
          <div key={file.name} className="bg-white rounded-[8px] border border-[#e5e7eb] overflow-hidden shadow-sm">
            <button
              onClick={() => toggleFile(file.name)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-[#faf5ff] to-white hover:from-[#f5f0ff] transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {file.icon === 'database'
                  ? <Database size={14} className="text-[#6a12cd]" />
                  : <FileText size={14} className="text-[#6a12cd]" />}
                <span className="text-[0.75rem] font-semibold text-[#26064a]">{file.name}</span>
              </div>
              <ChevronDown
                size={14}
                className="text-[#6a12cd] transition-transform"
                style={{ transform: isFileOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>
            {isFileOpen && (
              <div className="border-t border-[#f0f0f0]">
                {file.sheets.map(sheet => {
                  const sheetKey = `${file.name}::${sheet.name}`;
                  const isSheetOpen = expandedSheets[sheetKey] ?? false;
                  return (
                    <div key={sheetKey}>
                      <button
                        onClick={() => toggleSheet(sheetKey)}
                        className="w-full flex items-center justify-between px-4 py-2 hover:bg-[#faf5ff] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[0.6875rem] font-medium text-[#374151]">{sheet.name}</span>
                          <span className="text-[0.625rem] text-[#9ca3af]">({sheet.columns.length})</span>
                        </div>
                        <ChevronDown
                          size={12}
                          className="text-[#9ca3af] transition-transform"
                          style={{ transform: isSheetOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        />
                      </button>
                      {isSheetOpen && (
                        <div className="pb-1">
                          {sheet.columns.map(col => (
                            <div
                              key={col}
                              draggable={!!draggable}
                              onDragStart={draggable ? (e) => {
                                e.dataTransfer.effectAllowed = 'copy';
                                e.dataTransfer.setData('fieldId', fieldIdMap?.[col] || col);
                                if (fieldIdMap?.[col]) {
                                  const kind = col.match(/Amount|Count|Score|Risk|Time|Accuracy|Scanned|Found/) ? 'measure' : 'dimension';
                                  e.dataTransfer.setData('fieldKind', kind);
                                }
                              } : undefined}
                              className={`flex items-center gap-2.5 px-6 py-1.5 hover:bg-[#f0ecff] transition-colors ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
                            >
                              <GripVertical size={11} className="text-[#d1d5db] shrink-0" />
                              <span className="text-[0.6875rem] text-[#4b5563]">{col}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
