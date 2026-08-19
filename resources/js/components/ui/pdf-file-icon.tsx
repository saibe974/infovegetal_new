export function PdfFileIcon({ className = '' }: { className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={`block size-5 shrink-0 bg-no-repeat ${className}`}
            style={{
                backgroundImage: "url('/packages/barryvdh/elfinder/img/icons-big.svg')",
                backgroundPosition: '0 -187.5px',
                backgroundSize: '20px 750px',
            }}
        />
    );
}
