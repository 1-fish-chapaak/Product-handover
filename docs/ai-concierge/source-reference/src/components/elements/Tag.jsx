// import { cn } from '@/lib/utils';
// import PropTypes from 'prop-types';
// import React from 'react';

// const Tag = ({ icon, text, textClassName, className, iconClassName }) => {
// 	return (
// 		<div className={`flex items-center pt-3 pb-5 gap-3 border-b ${className}`}>
// 			<div className="p-[10px] bg-warning-50 rounded-full flex items-center justify-center">
// 				<div className="px-1.5 py-0.5 bg-warning-200 rounded-full flex items-center justify-center">
// 					{icon && (
// 						<span
// 							className={cn(
// 								'material-symbols-outlined text-warning-900',
// 								iconClassName,
// 							)}
// 						>
// 							{icon}
// 						</span>
// 					)}
// 				</div>
// 			</div>

// 			<span
// 				className={`text-warning-900 text-base font-semibold ${textClassName}`}
// 			>
// 				{text}
// 			</span>
// 		</div>
// 	);
// };

// Tag.propTypes = {
// 	icon: PropTypes.string,
// 	text: PropTypes.string.isRequired,
// };

// export default Tag;

import { cn } from '@/lib/utils';
import PropTypes from 'prop-types';
import React from 'react';

const Tag = ({ icon, text, textClassName, className, iconClassName }) => {
	return (
		<div
			className={`flex items-center shadow-md px-2 py-1 gap-2 rounded-full bg-[#26064A] ${className}`}
		>
			{icon && (
				<span
					className={cn(
						'material-symbols-outlined text-white',
						iconClassName,
					)}
				>
					{icon}
				</span>
			)}
			<span className={`text-white ${textClassName}`}>{text}</span>
		</div>
	);
};

Tag.propTypes = {
	icon: PropTypes.string,
	text: PropTypes.string.isRequired,
};

export default Tag;
