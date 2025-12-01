import * as React from 'react';
import { Button } from './button';
import { ChevronUp } from 'lucide-react';

const ScrollToTopButton = () => {
    const [showToTop, setShowToTop] = React.useState(false);

    React.useEffect(() => {
        const handleScroll = () => {
            setShowToTop(window.scrollY > 500);
        };

        window.addEventListener('scroll', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    return (
        <>
            {showToTop &&
                <Button className='fixed bottom-6 right-6 w-10 h-10 rounded-4xl' onClick={scrollToTop}>
                    <ChevronUp className='size-6' />
                </Button>
            }
        </>
    );
};

export default ScrollToTopButton;