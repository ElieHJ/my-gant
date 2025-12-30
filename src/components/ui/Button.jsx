import React from 'react';

export const Button = ({ children, onClick, variant = 'primary', className = '', icon: Icon, disabled = false, title = '' }) => {
    const baseStyle = "flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
        primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
        secondary: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm",
        danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200",
        ghost: "text-gray-600 hover:bg-gray-100"
    };
    return (
        <button onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`} disabled={disabled} title={title}>
            {Icon && <Icon size={16} />}
            {children}
        </button>
    );
};
