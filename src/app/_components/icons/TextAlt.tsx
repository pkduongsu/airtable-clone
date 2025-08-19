interface TextAltProps{
    className?: string,
    size?: number,
    color?: string,
}

export default function TextAlt({className, size, color}:TextAltProps) {
    return (
        <svg 
            width={size} 
            height={size} 
            viewBox="0 0 16 16" 
            className={className}
            xmlns="http://www.w3.org/2000/svg"
            >
                <path fill={color ?? "currentColor"} fillRule="evenodd" d="M8.44187 3.26606C8.35522 3.10237 8.18518 3 7.99998 3C7.81477 3 7.64474 3.10237 7.55808 3.26606L3.05808 11.7661C2.92888 12.0101 3.02198 12.3127 3.26603 12.4419C3.51009 12.5711 3.81267 12.478 3.94187 12.2339L5.12455 10H10.8754L12.0581 12.2339C12.1873 12.478 12.4899 12.5711 12.7339 12.4419C12.978 12.3127 13.0711 12.0101 12.9419 11.7661L8.44187 3.26606ZM10.346 9L7.99998 4.56863L5.65396 9H10.346Z"/>
        </svg>
    )
};