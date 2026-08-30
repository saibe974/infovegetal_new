import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { Clock3, Eye, FileText, Gift, Mail, PackageSearch, Send, Users } from 'lucide-react';

type Section = 'general' | 'products' | 'presentation' | 'coupons' | 'audience' | 'mailing' | 'publication';

type Props = {
    promotionId?: number | null;
    active: Section;
};

const sections: Array<{ id: Section; label: string; icon: typeof FileText }> = [
    { id: 'general', label: 'Général', icon: FileText },
    { id: 'presentation', label: 'Présentation', icon: Eye },
    { id: 'products', label: 'Produits', icon: PackageSearch },
    { id: 'coupons', label: 'Coupons', icon: Gift },
    { id: 'audience', label: 'Audience', icon: Users },
    { id: 'mailing', label: 'Mailing', icon: Mail },
    { id: 'publication', label: 'Publication', icon: Send },
];

export function PromotionWorkspaceNav({ promotionId, active }: Props) {
    const hrefFor = (section: Section): string | null => {
        if (!promotionId) return null;
        if (section === 'general') return `/promotions/${promotionId}/edit/general`;
        if (section === 'products') return `/promotions/${promotionId}/edit/products`;
        if (section === 'coupons') return `/promotions/${promotionId}/edit/coupons`;
        if (section === 'audience') return `/promotions/${promotionId}/edit/audience`;
        if (section === 'mailing') return `/promotions/${promotionId}/edit/mailing`;
        if (section === 'presentation') return `/promotions/${promotionId}/edit/presentation`;
        if (section === 'publication') return `/promotions/${promotionId}/edit/publication`;
        return null;
    };

    return (
        <nav className="space-y-1" aria-label="Sections de la promotion">
            {sections.map(({ id, label, icon: Icon }) => {
                const isActive = id === active;
                const href = hrefFor(id);
                const content = (
                    <>
                        <Icon className="size-4" />
                        <span>{label}</span>
                        {!href && !isActive && <Clock3 className="ml-auto size-3" aria-label="À venir" />}
                    </>
                );

                if (href && !isActive) {
                    return (
                        <Link key={id} href={href} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                            {content}
                        </Link>
                    );
                }

                return (
                    <div
                        key={id}
                        className={cn(
                            'flex items-center gap-3 rounded-md px-3 py-2 text-sm',
                            isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                        )}
                        aria-current={isActive ? 'page' : undefined}
                    >
                        {content}
                    </div>
                );
            })}

            <Button asChild variant="ghost" className="mt-3 w-full justify-start">
                <Link href="/promotions">Retour à la liste</Link>
            </Button>
        </nav>
    );
}
