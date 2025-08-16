interface SpinnerIconProps {
    className?: string,
    size?: number,
    color?: string,
}

export default function Spinner({className, size, color} : SpinnerIconProps) {
    return (
        <svg 
            width={size ?? 16} 
            height={size ?? 16} 
            viewBox="0 0 24 24"                                     
            className={`animate-spin ${className ?? ''}`}
            xmlns="http://www.w3.org/2000/svg"
        >
            <circle 
                cx="12" 
                cy="12" 
                r="10" 
                stroke={color ?? "currentColor"} 
                strokeWidth="2" 
                fill="none" 
                strokeLinecap="round"
                strokeDasharray="31.416"
                strokeDashoffset="15.708"
            />
        </svg>
    )
}