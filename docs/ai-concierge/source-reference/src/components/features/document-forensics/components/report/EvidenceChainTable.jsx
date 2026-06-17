const SEVERITY_CONFIG = {
	CRITICAL: {
		color: 'text-red-700',
		bgColor: 'bg-red-50',
		borderColor: 'border-red-200',
	},
	HIGH: {
		color: 'text-orange-700',
		bgColor: 'bg-orange-50',
		borderColor: 'border-orange-200',
	},
	MEDIUM: {
		color: 'text-amber-700',
		bgColor: 'bg-amber-50',
		borderColor: 'border-amber-200',
	},
	LOW: {
		color: 'text-blue-700',
		bgColor: 'bg-blue-50',
		borderColor: 'border-blue-200',
	},
};

const EvidenceChainTable = ({ evidenceChain }) => {
	if (!evidenceChain?.length) return null;

	const sorted = [...evidenceChain].sort((a, b) => {
		const order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
		return (
			order.indexOf(a.severity || 'LOW') - order.indexOf(b.severity || 'LOW')
		);
	});

	return (
		<div>
			<table className="w-full">
				<thead className="bg-gray-50">
					<tr>
						<th className="text-left px-4 py-2 text-xs font-medium text-primary60">
							Severity
						</th>
						<th className="text-left px-4 py-2 text-xs font-medium text-primary60">
							Module
						</th>
						<th className="text-left px-4 py-2 text-xs font-medium text-primary60">
							Finding
						</th>
					</tr>
				</thead>
				<tbody>
					{sorted.map((item, i) => {
						const sev =
							SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.LOW;
						return (
							<tr
								key={i}
								className="border-t border-gray-100 hover:bg-gray-50"
							>
								<td className="px-4 py-2.5">
									<span
										className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${sev.color} ${sev.bgColor} ${sev.borderColor}`}
									>
										{item.severity}
									</span>
								</td>
								<td className="px-4 py-2.5 text-sm text-primary60 font-medium">
									{item.module}
								</td>
								<td className="px-4 py-2.5 text-sm text-primary80">
									{item.finding}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
};

export default EvidenceChainTable;
