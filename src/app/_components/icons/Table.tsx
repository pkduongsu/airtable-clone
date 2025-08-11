interface TableIconProps{
    className?: string,
    size?: number,
    color?: string,
}

export default function House({className, size, color}:TableIconProps) {
    return (
        <svg 
            width={size} 
            height={size} 
            viewBox="0 0 16 16" 
            className={className}
            xmlns="http://www.w3.org/2000/svg"
            >
            <path fill={color} d="M2 3C1.8674 3.00001 1.74023 3.0527 1.64646 3.14646C1.5527 3.24023 1.50001 3.3674 1.5 3.5V12C1.50007 12.5463 1.95357 12.9999 2.49988 13C2.49984 13 2.49992 13 2.49988 13H13.5C14.0464 13 14.5 12.5464 14.5 12V3.5C14.5 3.3674 14.4473 3.24023 14.3535 3.14646C14.2598 3.0527 14.1326 3.00001 14 3H2ZM2.5 4H13.5V6H2.5V4ZM2.5 7H5V9H2.5V7ZM6 7H13.5V9H6V7ZM2.5 10H5V12H2.50012L2.5 10ZM6 10H13.5V12H6V10Z"/>
        </svg>
    )
};