const Spinner = ({ className = '', size = 'sm', color = '' }) => {
	return (
		<div
			className={`spinner ${size} ${color === 'white' ? 'white' : ''} ${className} notranslate`}
		>
			{Array.from({ length: 12 }).map((_, i) => (
				<div key={i} className="spinner-blade"></div>
			))}
		</div>
	);
};

export default Spinner;
