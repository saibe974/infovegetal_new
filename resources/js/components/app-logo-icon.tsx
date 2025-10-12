import { SVGAttributes } from 'react';

function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg {...props} viewBox="0 0 250 160" xmlns="http://www.w3.org/2000/svg">
            {/* <rect x="0" y="0" width="250" height="160" fill="red" /> */}
            <circle cx="60" cy="60" r="50" fill="#9C0060" />
            <text x="113" y="125" fontFamily="arial, sans-serif" fontSize="60" fontWeight="600" fill="currentColor">inf</text>
            <circle cx="90" cy="80" r="45" fill="#C6E300" />
            <circle cx="119" cy="95" r="13" className="fill-background dark:fill-gray-900" />
            <circle cx="212" cy="120" r="30" fill="#C6E300" />
            <text x="95" y="145" fontFamily="arial, sans-serif" fontSize="25" fontWeight="600" fill="currentColor">vegetal</text>
        </svg>
    );
}

function AppLogoIconMini(props: SVGAttributes<SVGElement>) {
    return (
        <svg {...props} viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg">
            {/* <rect x="0" y="0" width="140" height="140" fill="red" /> */}
            <circle cx="57" cy="60" r="50" fill="#9C0060" />
            <circle cx="87" cy="80" r="45" fill="#C6E300" />
            <circle cx="116" cy="95" r="13" className="fill-background dark:fill-gray-900" />
        </svg>
    );
}

export { AppLogoIconMini };
export default AppLogoIcon;