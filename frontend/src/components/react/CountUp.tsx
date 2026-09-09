import React, { useEffect, useRef, useState } from 'react';

interface CountUpProps {
    to: number;
    from?: number;
    duration?: number;
    decimals?: number;
    prefix?: string;
    suffix?: string;
    separator?: string;
    className?: string;
}

export const CountUp: React.FC<CountUpProps> = ({
    to,
    from = 0,
    duration = 1.5,
    decimals = 0,
    prefix = '',
    suffix = '',
    separator = ',',
    className = ''
}) => {
    const [count, setCount] = useState(from);
    const elementRef = useRef<HTMLSpanElement>(null);
    const hasAnimated = useRef(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasAnimated.current) {
                    hasAnimated.current = true;
                    let startTime: number | null = null;
                    const durationMs = duration * 1000;

                    const animate = (timestamp: number) => {
                        if (!startTime) startTime = timestamp;
                        const progress = Math.min((timestamp - startTime) / durationMs, 1);
                        // easeOutExpo
                        const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
                        const currentVal = from + (to - from) * ease;
                        setCount(currentVal);

                        if (progress < 1) {
                            requestAnimationFrame(animate);
                        } else {
                            setCount(to);
                        }
                    };

                    requestAnimationFrame(animate);
                }
            },
            { threshold: 0.2 }
        );

        if (elementRef.current) {
            observer.observe(elementRef.current);
        }

        return () => observer.disconnect();
    }, [to, from, duration]);

    const formatNumber = (val: number) => {
        const fixed = val.toFixed(decimals);
        const [integerPart, decimalPart] = fixed.split('.');
        const withSeparator = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
        return decimalPart ? `${withSeparator}.${decimalPart}` : withSeparator;
    };

    return (
        <span ref={elementRef} className={`count-up-val ${className}`}>
            {prefix}{formatNumber(count)}{suffix}
        </span>
    );
};

export default CountUp;
