import { useState } from 'react';
import { INITIAL_EXTRACTION_FIELDS } from '../../constants/table-extractor.constants';

const TEMPLATE_STORAGE_KEY = 'TE_IRAME_TEMPLATES';

const FieldCard = ({ field, onUpdate, onRemove }) => (
	<div className="p-3 bg-white/60 backdrop-blur-sm border border-white/70 rounded-xl group relative shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] hover:border-[rgba(106,18,205,0.2)] transition-all">
		<button
			onClick={() => onRemove(field.id)}
			className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 z-10 shadow-md flex items-center justify-center"
		>
			<svg
				className="w-3 h-3"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={3}
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
		<div className="space-y-2">
			<input
				className="w-full bg-white/40 text-xs font-semibold text-primary80 p-2 rounded-lg outline-none border border-transparent focus:border-[rgba(106,18,205,0.3)] focus:bg-white uppercase"
				value={field.name}
				onChange={(e) =>
					onUpdate(field.id, {
						name: e.target.value.replace(/\W/g, '_').toLowerCase(),
					})
				}
				placeholder="FIELD_NAME"
			/>
			<div className="flex gap-2">
				<select
					className="text-[10px] bg-purple-4 border border-[rgba(106,18,205,0.1)] rounded-lg px-2 py-1 font-semibold text-purple-100 outline-none"
					value={field.type}
					onChange={(e) => onUpdate(field.id, { type: e.target.value })}
				>
					<option value="string">TXT</option>
					<option value="number">NUM</option>
					<option value="date">DAT</option>
				</select>
				<input
					className="flex-1 text-[10px] bg-white/30 border border-transparent rounded-lg px-2 py-1 outline-none italic text-primary40 focus:bg-white focus:border-gray-200"
					value={field.description}
					onChange={(e) =>
						onUpdate(field.id, { description: e.target.value })
					}
					placeholder="AI instructions..."
				/>
			</div>
		</div>
	</div>
);

const SchemaBuilder = ({ fields, setFields }) => {
	const [templates, setTemplates] = useState(() => {
		try {
			const stored = localStorage.getItem(TEMPLATE_STORAGE_KEY);
			return stored ? JSON.parse(stored) : [];
		} catch {
			return [];
		}
	});
	const [newTemplateName, setNewTemplateName] = useState('');

	const updateField = (id, updates) => {
		setFields((prev) =>
			prev.map((f) => (f.id === id ? { ...f, ...updates } : f)),
		);
	};

	const removeField = (id) => {
		setFields((prev) => prev.filter((f) => f.id !== id));
	};

	const addField = (source) => {
		const id = Date.now().toString() + Math.random().toString(36).substr(2, 4);
		setFields((prev) => [
			...prev,
			{
				id,
				name: source === 'header' ? 'field' : 'column',
				type: 'string',
				description: '',
				source,
			},
		]);
	};

	const saveTemplate = () => {
		if (!newTemplateName.trim()) return;
		const template = {
			id: Date.now().toString(),
			name: newTemplateName.trim(),
			fields: [...fields],
		};
		const updated = [...templates, template];
		setTemplates(updated);
		localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(updated));
		setNewTemplateName('');
	};

	const loadTemplate = (template) => {
		setFields(template.fields);
	};

	const deleteTemplate = (id, e) => {
		e.stopPropagation();
		const updated = templates.filter((t) => t.id !== id);
		setTemplates(updated);
		localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(updated));
	};

	const exportFieldsCsv = () => {
		if (fields.length === 0) return;
		const header = 'Field Name,Type,Description,Source\n';
		const rows = fields
			.map((f) => `${f.name},${f.type},${f.description},${f.source}`)
			.join('\n');
		const blob = new Blob([header + rows], { type: 'text/csv' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `extraction_layout_${Date.now()}.csv`;
		a.click();
		URL.revokeObjectURL(a.href);
	};

	const importFieldsCsv = (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (ev) => {
			const lines = (ev.target?.result || '')
				.split('\n')
				.filter((x) => x.trim());
			const newFields = [];
			lines.slice(1).forEach((line, i) => {
				const [name, type, description, source] = line
					.split(',')
					.map((s) => s.trim());
				if (name) {
					newFields.push({
						id: `imp-${i}-${Date.now()}`,
						name: name.replace(/\W/g, '_').toLowerCase(),
						type: type || 'string',
						description: description || '',
						source: source || 'table',
					});
				}
			});
			if (newFields.length > 0) setFields(newFields);
		};
		reader.readAsText(file);
		e.target.value = '';
	};

	const resetToDefault = () => {
		setFields([...INITIAL_EXTRACTION_FIELDS]);
	};

	const headerFields = fields.filter((f) => f.source === 'header');
	const tableFields = fields.filter((f) => f.source === 'table');

	return (
		<div className="grid grid-cols-12 gap-5">
			{/* Templates Panel */}
			<div className="col-span-3">
				<div className="space-y-4">
					<div>
						<div className="flex justify-between items-center mb-3">
							<h3 className="text-xs font-semibold text-primary20 uppercase tracking-wider">
								Layout Profiles
							</h3>
							<label className="cursor-pointer p-1.5 hover:bg-purple-4 rounded-lg text-purple-100 border border-[rgba(106,18,205,0.1)] transition-all">
								<svg
									className="w-3.5 h-3.5"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
									/>
								</svg>
								<input
									type="file"
									className="hidden"
									accept=".csv"
									onChange={importFieldsCsv}
								/>
							</label>
						</div>
						<div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1">
							{templates.map((t) => (
								<div
									key={t.id}
									onClick={() => loadTemplate(t)}
									className="group flex items-center justify-between p-2.5 text-xs font-medium bg-white/40 backdrop-blur-sm hover:bg-purple-4 rounded-lg cursor-pointer transition-all border border-transparent hover:border-[rgba(106,18,205,0.1)]"
								>
									<span className="truncate text-primary80 mr-2">
										{t.name}
									</span>
									<button
										onClick={(e) => deleteTemplate(t.id, e)}
										className="text-primary40 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 shrink-0"
									>
										<svg
											className="w-3.5 h-3.5"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M6 18L18 6M6 6l12 12"
											/>
										</svg>
									</button>
								</div>
							))}
							{templates.length === 0 && (
								<div className="text-[11px] text-primary40 italic text-center py-6 border border-dashed border-[rgba(106,18,205,0.1)] rounded-lg">
									No profiles saved
								</div>
							)}
						</div>
					</div>
					<div className="pt-3 border-t border-[rgba(106,18,205,0.06)] space-y-2">
						<input
							className="w-full text-xs p-2.5 bg-white/40 border border-gray-200 rounded-lg outline-none focus:border-[rgba(106,18,205,0.3)]"
							placeholder="Profile name..."
							value={newTemplateName}
							onChange={(e) => setNewTemplateName(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && saveTemplate()}
						/>
						<button
							onClick={saveTemplate}
							disabled={!newTemplateName.trim()}
							className="w-full py-2 text-xs font-medium bg-primary80 text-white rounded-lg hover:bg-primary60 transition-all disabled:opacity-40"
						>
							Save Layout
						</button>
					</div>
				</div>
			</div>

			{/* Schema Editor */}
			<div className="col-span-6">
				<div className="space-y-5">
					<div className="flex justify-between items-center">
						<h3 className="text-xs font-semibold text-primary20 uppercase tracking-wider">
							Extraction Schema
						</h3>
						<div className="flex gap-1.5">
							<button
								onClick={resetToDefault}
								className="p-1.5 text-primary40 hover:text-purple-100 transition-all"
								title="Reset to default"
							>
								<svg
									className="w-4 h-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={1.5}
										d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
									/>
								</svg>
							</button>
							<button
								onClick={exportFieldsCsv}
								disabled={fields.length === 0}
								className="p-1.5 text-primary40 hover:text-purple-100 transition-all disabled:opacity-30"
								title="Export layout CSV"
							>
								<svg
									className="w-4 h-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={1.5}
										d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
									/>
								</svg>
							</button>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-5">
						{/* Header Fields */}
						<div className="space-y-2.5">
							<div className="flex justify-between items-center">
								<span className="text-xs font-medium text-primary60">
									Header Metadata
								</span>
								<button
									onClick={() => addField('header')}
									className="w-6 h-6 rounded-full bg-white/60 backdrop-blur-sm border border-[rgba(106,18,205,0.1)] shadow-[0_2px_8px_rgba(106,18,205,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] flex items-center justify-center text-purple-100 hover:bg-purple-4 transition-all"
								>
									<svg
										className="w-3.5 h-3.5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M12 4v16m8-8H4"
										/>
									</svg>
								</button>
							</div>
							{headerFields.map((f) => (
								<FieldCard
									key={f.id}
									field={f}
									onUpdate={updateField}
									onRemove={removeField}
								/>
							))}
							{headerFields.length === 0 && (
								<p className="text-[11px] text-primary40 italic text-center py-4">
									No header fields defined
								</p>
							)}
						</div>
						{/* Table Fields */}
						<div className="space-y-2.5">
							<div className="flex justify-between items-center">
								<span className="text-xs font-medium text-primary60">
									Line Items (Table)
								</span>
								<button
									onClick={() => addField('table')}
									className="w-6 h-6 rounded-full bg-white/60 backdrop-blur-sm border border-[rgba(106,18,205,0.1)] shadow-[0_2px_8px_rgba(106,18,205,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] flex items-center justify-center text-purple-100 hover:bg-purple-4 transition-all"
								>
									<svg
										className="w-3.5 h-3.5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M12 4v16m8-8H4"
										/>
									</svg>
								</button>
							</div>
							{tableFields.map((f) => (
								<FieldCard
									key={f.id}
									field={f}
									onUpdate={updateField}
									onRemove={removeField}
								/>
							))}
							{tableFields.length === 0 && (
								<p className="text-[11px] text-primary40 italic text-center py-4">
									No line item fields defined
								</p>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* How It Works */}
			<div className="col-span-3">
				<div className="space-y-4">
					<h3 className="text-xs font-semibold text-primary20 uppercase tracking-wider">
						How It Works
					</h3>
					<div className="space-y-3">
						{[
							{
								title: 'Define Schema',
								desc: 'Set header metadata and line item fields',
							},
							{
								title: 'Upload PDFs',
								desc: 'Add your invoice or document files',
							},
							{
								title: 'AI Extracts',
								desc: 'Gemini reads each page and extracts data',
							},
							{
								title: 'Export CSV',
								desc: 'Download structured results',
							},
						].map((item, i) => (
							<div key={item.title} className="flex gap-3 items-start">
								<div className="w-7 h-7 rounded-full bg-white/60 backdrop-blur-sm border border-[rgba(106,18,205,0.1)] shadow-[0_2px_8px_rgba(106,18,205,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] flex items-center justify-center shrink-0">
									<span className="text-purple-100 font-bold text-xs">
										{i + 1}
									</span>
								</div>
								<div>
									<p className="text-xs font-semibold text-primary80">
										{item.title}
									</p>
									<p className="text-[11px] text-primary40 mt-0.5 leading-tight">
										{item.desc}
									</p>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
};

export default SchemaBuilder;
