import React, { useEffect, useRef, useState } from 'react';

interface SplitRevealProps {
    text: string;
    as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span';
    className?: string;
    delayMs?: number;
    staggerMs?: number;
}

export const SplitReveal: React.FC<SplitRevealProps> = ({
    text,
    as: Tag = 'h2',
    className = '',
    delayMs = 0,
    staggerMs = 30
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const elementRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.1 }
        );

        if (elementRef.current) {
            observer.observe(elementRef.current);
        }

        return () => observer.disconnect();
    }, []);

    const words = text.split(' ');

    return (
        <Tag
            ref={elementRef as unknown as React.Ref<HTMLHeadingElement>}
            className={`split-reveal-container ${className}`}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25em' }}
        >
            {words.map((word, wordIndex) => (
                <span key={wordIndex} style={{ display: 'inline-flex', overflow: 'hidden' }}>
                    <span
                        style={{
                            display: 'inline-block',
                            transform: isVisible ? 'translateY(0)' : 'translateY(110%)',
                            opacity: isVisible ? 1 : 0,
                            transition: `transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s ease`,
                            transitionDelay: `${delayMs + wordIndex * staggerMs}ms`
                        }}
                    >
                        {word}
                    </span>
                </span>
            ))}
        </Tag>
    );
};

export default SplitReveal;
