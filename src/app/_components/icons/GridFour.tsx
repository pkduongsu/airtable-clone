interface GridFourProps {
    className?: string,
    size?: number,
    color?: string
}

export default function GridFour({className, size, color} : GridFourProps) {
    return (
        <svg 
            width={size} 
            height={size} 
            viewBox="0 0 16 16" 
            className={className}
            xmlns="http://www.w3.org/2000/svg"
        >
            <path fill={color} d="M3.25 2.25C2.70364 2.25 2.25 2.70364 2.25 3.25V12.75C2.25 13.2964 2.70364 13.75 3.25 13.75H12.75C13.2964 13.75 13.75 13.2964 13.75 12.75V3.25C13.75 2.70364 13.2964 2.25 12.75 2.25H3.25ZM3.25 3.25H7.5V7.5H3.25V3.25ZM8.5 3.25H12.75V7.5H8.5V3.25ZM3.25 8.5H7.5V12.75H3.25V8.5ZM8.5 8.5H12.75V12.75H8.5V8.5Z"/>
        </svg>
    )
}